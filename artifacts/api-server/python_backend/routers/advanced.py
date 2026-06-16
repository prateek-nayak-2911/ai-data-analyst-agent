import os
import uuid
import math
from datetime import datetime, timezone
from typing import Optional

import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import store

router = APIRouter()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
REPORTS_DIR = os.environ.get("REPORTS_DIR", "/tmp/data_analyst_reports")
os.makedirs(REPORTS_DIR, exist_ok=True)


def _load_df(dataset_id: str) -> tuple[dict, pd.DataFrame]:
    d = store.get_dataset(dataset_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")
    file_path = d.get("filePath", "")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset file not found")
    ext = d["filename"].lower().rsplit(".", 1)[-1]
    df = pd.read_csv(file_path) if ext == "csv" else pd.read_excel(file_path)
    return d, df


def _safe(v):
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else f
    if isinstance(v, np.bool_):
        return bool(v)
    return v


# ────────────────────────────────────────────────────────────────
# Forecasting
# ────────────────────────────────────────────────────────────────

@router.get("/datasets/{dataset_id}/forecast")
def get_forecast(dataset_id: str, column: Optional[str] = None, periods: int = 10):
    d, df = _load_df(dataset_id)
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if not numeric_cols:
        raise HTTPException(status_code=400, detail="No numeric columns available for forecasting")

    target_col = column if (column and column in numeric_cols) else numeric_cols[0]
    series = df[target_col].dropna()
    if len(series) < 4:
        raise HTTPException(status_code=400, detail="Not enough data points for forecasting (need >= 4)")

    n = len(series)
    x = np.arange(n, dtype=float)
    y = series.values.astype(float)

    # Linear trend
    coeffs = np.polyfit(x, y, 1)
    slope, intercept = coeffs

    # Residuals → simple seasonal component via binned average
    trend = np.polyval(coeffs, x)
    residuals = y - trend

    # Detect periodicity (cap at 12 for monthly-style data)
    period = min(max(4, n // 6), 12)
    seasonal = np.array([residuals[i::period].mean() for i in range(period)])

    # Historical fitted values
    historical = []
    for i in range(n):
        fitted = trend[i] + seasonal[i % period]
        historical.append({
            "index": i,
            "actual": _safe(y[i]),
            "fitted": _safe(fitted),
            "isForecast": False,
        })

    # Forecast
    last_std = float(np.std(residuals))
    for i in range(periods):
        xi = n + i
        pred = slope * xi + intercept + seasonal[xi % period]
        ci = 1.96 * last_std * math.sqrt(1 + (xi - x.mean()) ** 2 / np.var(x))
        historical.append({
            "index": xi,
            "actual": None,
            "fitted": _safe(pred),
            "lower": _safe(pred - ci),
            "upper": _safe(pred + ci),
            "isForecast": True,
        })

    r2 = float(1 - np.sum((y - trend) ** 2) / np.sum((y - y.mean()) ** 2))

    return {
        "column": target_col,
        "periods": periods,
        "method": "Linear Trend + Seasonal Decomposition",
        "slope": _safe(slope),
        "r2": round(max(0.0, r2), 4),
        "availableColumns": numeric_cols,
        "data": historical,
    }


# ────────────────────────────────────────────────────────────────
# Anomaly Detection
# ────────────────────────────────────────────────────────────────

@router.get("/datasets/{dataset_id}/anomalies")
def get_anomalies(dataset_id: str, column: Optional[str] = None, method: str = "iqr"):
    d, df = _load_df(dataset_id)
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if not numeric_cols:
        raise HTTPException(status_code=400, detail="No numeric columns")

    target_col = column if (column and column in numeric_cols) else numeric_cols[0]
    series = df[target_col].dropna()

    if method == "zscore":
        mean, std = series.mean(), series.std()
        z_scores = (series - mean) / std if std > 0 else pd.Series(np.zeros(len(series)), index=series.index)
        threshold = 2.5
        is_anomaly = z_scores.abs() > threshold
        scores = z_scores.abs()
    else:  # IQR
        q1, q3 = series.quantile(0.25), series.quantile(0.75)
        iqr = q3 - q1
        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        is_anomaly = (series < lower) | (series > upper)
        scores = ((series - series.median()) / (iqr + 1e-9)).abs()

    data = []
    for i, (idx, val) in enumerate(series.items()):
        data.append({
            "index": i,
            "rowIndex": int(idx),
            "value": _safe(val),
            "score": _safe(float(scores.loc[idx])),
            "isAnomaly": bool(is_anomaly.loc[idx]),
        })

    anomaly_count = int(is_anomaly.sum())
    anomaly_pct = round(anomaly_count / len(series) * 100, 2) if len(series) > 0 else 0

    return {
        "column": target_col,
        "method": "Z-Score" if method == "zscore" else "IQR (Interquartile Range)",
        "totalPoints": len(series),
        "anomalyCount": anomaly_count,
        "anomalyPercent": anomaly_pct,
        "availableColumns": numeric_cols,
        "data": data,
    }


# ────────────────────────────────────────────────────────────────
# Correlation Analysis
# ────────────────────────────────────────────────────────────────

@router.get("/datasets/{dataset_id}/correlation")
def get_correlation(dataset_id: str):
    d, df = _load_df(dataset_id)
    numeric_df = df.select_dtypes(include=[np.number])
    if numeric_df.shape[1] < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 numeric columns for correlation")

    corr = numeric_df.corr()
    columns = corr.columns.tolist()

    matrix = []
    for col_a in columns:
        for col_b in columns:
            val = corr.loc[col_a, col_b]
            matrix.append({
                "x": col_a,
                "y": col_b,
                "value": _safe(val),
            })

    # Top correlations (excluding self-correlation)
    pairs = []
    seen = set()
    for i, col_a in enumerate(columns):
        for j, col_b in enumerate(columns):
            if i >= j:
                continue
            key = tuple(sorted([col_a, col_b]))
            if key not in seen:
                seen.add(key)
                val = float(corr.loc[col_a, col_b])
                if not math.isnan(val):
                    pairs.append({"colA": col_a, "colB": col_b, "correlation": round(val, 4)})

    pairs.sort(key=lambda p: abs(p["correlation"]), reverse=True)

    return {
        "columns": columns,
        "matrix": matrix,
        "topPairs": pairs[:10],
    }


# ────────────────────────────────────────────────────────────────
# Executive Report (AI-powered PDF)
# ────────────────────────────────────────────────────────────────

class ExecReportInput(BaseModel):
    title: Optional[str] = None
    audience: Optional[str] = "executive"


def _call_gemini_sync(api_key: str, prompt: str) -> Optional[str]:
    """Blocking Gemini call — run in executor with timeout."""
    try:
        from google import genai as new_genai
        client = new_genai.Client(api_key=api_key)
        response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
        return response.text.strip()
    except Exception:
        return None


@router.post("/datasets/{dataset_id}/executive-report")
async def generate_executive_report(dataset_id: str, body: ExecReportInput):
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, KeepTogether
    )
    from routers.analysis import _build_summary, _fallback_insights, _extract_key_findings

    d, df = _load_df(dataset_id)
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
    summary = _build_summary(df, d["name"])
    title = body.title or f"Executive Report: {d['name']}"

    # ── AI narrative (15 s timeout) ──────────────────────────────
    ai_text = None
    if GEMINI_API_KEY:
        prompt = f"""You are a senior data scientist writing an executive summary for C-suite leaders.

Dataset: {d['name']}
{summary}

Write a concise, insight-driven executive report with:
1. EXECUTIVE SUMMARY (2-3 sentences, key takeaway)
2. KEY FINDINGS (4-5 bullet points with specific numbers)
3. STRATEGIC RECOMMENDATIONS (3-4 actionable bullets)
4. RISK & LIMITATIONS (2-3 short bullets)

Use plain language. Be specific with numbers. No markdown headers — use the section labels above exactly."""
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor(max_workers=1) as pool:
            try:
                ai_text = await asyncio.wait_for(
                    loop.run_in_executor(pool, _call_gemini_sync, GEMINI_API_KEY, prompt),
                    timeout=20.0,
                )
            except (asyncio.TimeoutError, Exception):
                ai_text = None

    # Parse AI sections or build fallback
    sections = _parse_exec_sections(ai_text, df, d)

    # ── PDF generation ────────────────────────────────────────────
    report_id = str(uuid.uuid4())
    pdf_path = os.path.join(REPORTS_DIR, f"{report_id}.pdf")

    doc = SimpleDocTemplate(
        pdf_path, pagesize=A4,
        rightMargin=0.75 * inch, leftMargin=0.75 * inch,
        topMargin=1 * inch, bottomMargin=0.75 * inch,
    )
    styles = getSampleStyleSheet()

    ACCENT = colors.HexColor("#00E5FF")
    DARK = colors.HexColor("#0f172a")
    MID = colors.HexColor("#334155")
    LIGHT = colors.HexColor("#f8fafc")

    title_style = ParagraphStyle("ExecTitle", parent=styles["Title"],
        fontSize=22, textColor=DARK, spaceAfter=4)
    subtitle_style = ParagraphStyle("ExecSub", parent=styles["Normal"],
        fontSize=10, textColor=MID, spaceAfter=2)
    section_style = ParagraphStyle("ExecSection", parent=styles["Heading2"],
        fontSize=13, textColor=colors.HexColor("#6366f1"),
        spaceBefore=14, spaceAfter=6, fontName="Helvetica-Bold")
    body_style = ParagraphStyle("ExecBody", parent=styles["Normal"],
        fontSize=10, leading=15, textColor=MID)
    bullet_style = ParagraphStyle("ExecBullet", parent=styles["Normal"],
        fontSize=10, leading=15, textColor=MID,
        leftIndent=14, spaceAfter=3)
    small_style = ParagraphStyle("Small", parent=styles["Normal"],
        fontSize=8, textColor=colors.HexColor("#94a3b8"))

    story = []

    # Cover
    story.append(Paragraph(title, title_style))
    story.append(Paragraph(
        f"Dataset: {d['name']}  ·  Generated {datetime.now().strftime('%B %d, %Y')}  ·  {len(df):,} rows × {len(df.columns)} columns",
        subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=ACCENT, spaceAfter=14))

    # Quick stats bar
    stat_data = [[
        f"{len(df):,}", f"{len(df.columns)}", f"{len(numeric_cols)}", f"{len(cat_cols)}", f"{int(df.isna().sum().sum()):,}"
    ], [
        "Total Rows", "Columns", "Numeric", "Categorical", "Missing Values"
    ]]
    stat_table = Table(stat_data, colWidths=[1.3 * inch] * 5)
    stat_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 16),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
        ("FONTSIZE", (0, 1), (-1, 1), 8),
        ("TEXTCOLOR", (0, 1), (-1, 1), MID),
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [LIGHT]),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("PADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(stat_table)
    story.append(Spacer(1, 12))

    # AI sections
    for section_title, paragraphs, bullets in sections:
        story.append(Paragraph(section_title, section_style))
        for para in paragraphs:
            if para.strip():
                story.append(Paragraph(para, body_style))
        for b in bullets:
            if b.strip():
                story.append(Paragraph(f"• {b}", bullet_style))
        story.append(Spacer(1, 6))

    # Column statistics table
    story.append(Paragraph("Column Statistics", section_style))
    col_data = [["Column", "Type", "Min", "Max", "Mean / Top Value", "Nulls"]]
    for col in df.columns[:10]:
        series = df[col]
        is_num = pd.api.types.is_numeric_dtype(series)
        top_val = f"{series.mean():.2f}" if is_num else str(series.value_counts().index[0])[:18] if not series.empty else ""
        col_data.append([
            col[:22], str(series.dtype)[:8],
            f"{series.min():.2f}" if is_num else "—",
            f"{series.max():.2f}" if is_num else "—",
            top_val,
            str(int(series.isna().sum())),
        ])
    col_table = Table(col_data, colWidths=[1.5*inch, 0.7*inch, 0.7*inch, 0.7*inch, 1.4*inch, 0.5*inch])
    col_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT, colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(col_table)

    # Numeric summary
    if numeric_cols:
        story.append(Spacer(1, 10))
        story.append(Paragraph("Numeric Summary", section_style))
        num_data = [["Column", "Mean", "Std Dev", "Min", "Max", "Median"]]
        for col in numeric_cols[:8]:
            s = df[col].dropna()
            num_data.append([
                col[:22],
                f"{s.mean():.2f}", f"{s.std():.2f}",
                f"{s.min():.2f}", f"{s.max():.2f}", f"{s.median():.2f}",
            ])
        num_table = Table(num_data, colWidths=[1.5*inch, 0.9*inch, 0.9*inch, 0.9*inch, 0.9*inch, 0.9*inch])
        num_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT, colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
            ("PADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(num_table)

    # Footer
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0")))
    story.append(Paragraph("Confidential — Generated by AI Data Analyst Agent", small_style))

    doc.build(story)

    now = datetime.now(timezone.utc).isoformat()
    report = {
        "id": report_id,
        "datasetId": dataset_id,
        "datasetName": d["name"],
        "title": title,
        "createdAt": now,
        "downloadUrl": f"/api/reports/files/{report_id}.pdf",
        "pdfPath": pdf_path,
    }
    store.add_report(report)
    return {k: v for k, v in report.items() if k != "pdfPath"}


def _parse_exec_sections(ai_text: Optional[str], df: pd.DataFrame, d: dict):
    """Parse AI output into (title, paragraphs, bullets) triples, or build fallback."""
    from routers.analysis import _fallback_insights, _extract_key_findings

    if not ai_text:
        findings = _extract_key_findings(df)
        return [
            ("Executive Summary", [_fallback_insights(df, d["name"])], []),
            ("Key Findings", [], findings),
            ("Strategic Recommendations", [], [
                "Investigate columns with high missing-value rates before modelling",
                "Explore correlations between numeric features for predictive signals",
                "Consider segmenting analysis by categorical dimensions",
            ]),
            ("Risks & Limitations", [], [
                "Analysis based on available snapshot; results may shift with newer data",
                "Statistical patterns do not imply causation",
            ]),
        ]

    labels = ["EXECUTIVE SUMMARY", "KEY FINDINGS", "STRATEGIC RECOMMENDATIONS", "RISK"]
    display = ["Executive Summary", "Key Findings", "Strategic Recommendations", "Risks & Limitations"]
    sections = []
    lines = ai_text.split("\n")

    current_label_idx = -1
    current_paras: list[str] = []
    current_bullets: list[str] = []

    def flush():
        if current_label_idx >= 0:
            sections.append((display[current_label_idx], current_paras[:], current_bullets[:]))

    for line in lines:
        stripped = line.strip()
        matched = False
        for i, lbl in enumerate(labels):
            if lbl in stripped.upper():
                flush()
                current_label_idx = i
                current_paras = []
                current_bullets = []
                matched = True
                break
        if matched:
            continue
        if stripped.startswith(("•", "-", "*", "·")) or (len(stripped) > 1 and stripped[0].isdigit() and stripped[1] in ".):"):
            current_bullets.append(stripped.lstrip("•-*· 0123456789.)").strip())
        elif stripped:
            current_paras.append(stripped)

    flush()

    # Ensure all 4 sections exist
    titles_found = {s[0] for s in sections}
    for i, disp in enumerate(display):
        if disp not in titles_found:
            sections.append((disp, [], []))

    return sections
