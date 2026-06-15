import os
import uuid
import io
from datetime import datetime, timezone
from typing import Optional

import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)

import store
from routers.analysis import _build_summary, _fallback_insights, _extract_key_findings

REPORTS_DIR = os.environ.get("REPORTS_DIR", "/tmp/data_analyst_reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

router = APIRouter()


class ReportInput(BaseModel):
    title: Optional[str] = None
    includeCharts: Optional[bool] = True
    includeInsights: Optional[bool] = True
    includeKpis: Optional[bool] = True


def _load_df(dataset_id: str) -> tuple[dict, pd.DataFrame]:
    d = store.get_dataset(dataset_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")
    file_path = d.get("filePath", "")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset file not found")
    ext = d["filename"].lower().rsplit(".", 1)[-1]
    if ext == "csv":
        df = pd.read_csv(file_path)
    else:
        df = pd.read_excel(file_path)
    return d, df


def _generate_pdf(d: dict, df: pd.DataFrame, title: str, include_insights: bool, include_kpis: bool) -> str:
    report_id = str(uuid.uuid4())
    pdf_path = os.path.join(REPORTS_DIR, f"{report_id}.pdf")

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=1 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Title"],
        fontSize=24,
        textColor=colors.HexColor("#6366f1"),
        spaceAfter=6,
    )
    heading_style = ParagraphStyle(
        "CustomHeading",
        parent=styles["Heading2"],
        fontSize=14,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=16,
        spaceAfter=8,
    )
    body_style = ParagraphStyle(
        "CustomBody",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#334155"),
    )
    small_style = ParagraphStyle(
        "Small",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#64748b"),
    )

    story = []

    # Title
    story.append(Paragraph(title, title_style))
    story.append(Paragraph(f"Generated on {datetime.now().strftime('%B %d, %Y at %H:%M')}", small_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0"), spaceAfter=12))

    # Dataset summary
    story.append(Paragraph("Dataset Overview", heading_style))
    summary_data = [
        ["Property", "Value"],
        ["Dataset Name", d["name"]],
        ["Filename", d["filename"]],
        ["Total Rows", f"{d['rowCount']:,}"],
        ["Total Columns", str(d["columnCount"])],
        ["File Size", _format_size(d["fileSize"])],
        ["Uploaded", d["uploadedAt"][:10]],
    ]
    table = Table(summary_data, colWidths=[2 * inch, 4 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
        ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(table)
    story.append(Spacer(1, 12))

    # Column info
    story.append(Paragraph("Column Details", heading_style))
    col_data = [["Column", "Type", "Non-Null", "Unique", "Min", "Max"]]
    for col in df.columns:
        series = df[col]
        is_num = pd.api.types.is_numeric_dtype(series)
        col_data.append([
            col[:25],
            str(series.dtype),
            str(series.notna().sum()),
            str(series.nunique()),
            f"{series.min():.2f}" if is_num else str(series.min())[:15],
            f"{series.max():.2f}" if is_num else str(series.max())[:15],
        ])
    col_table = Table(col_data, colWidths=[1.5 * inch, 0.8 * inch, 0.8 * inch, 0.7 * inch, 0.9 * inch, 0.9 * inch])
    col_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(col_table)
    story.append(Spacer(1, 12))

    # KPIs
    if include_kpis:
        story.append(Paragraph("Key Performance Indicators", heading_style))
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        kpi_data = [["Metric", "Value"]]
        for col in numeric_cols[:6]:
            s = df[col].dropna()
            if not s.empty:
                kpi_data.append([f"Total {col}", _format_number(float(s.sum()))])
                kpi_data.append([f"Average {col}", _format_number(float(s.mean()))])
        kpi_data.append(["Total Rows", f"{len(df):,}"])
        kpi_data.append(["Missing Values", str(int(df.isna().sum().sum()))])

        kpi_table = Table(kpi_data, colWidths=[3.5 * inch, 2.5 * inch])
        kpi_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#eef2ff"), colors.white]),
            ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(kpi_table)
        story.append(Spacer(1, 12))

    # Insights
    if include_insights:
        story.append(Paragraph("AI Analysis & Insights", heading_style))
        insights_text = _fallback_insights(df, d["name"])
        story.append(Paragraph(insights_text, body_style))
        story.append(Spacer(1, 8))

        findings = _extract_key_findings(df)
        story.append(Paragraph("Key Findings:", ParagraphStyle("Bold", parent=body_style, fontName="Helvetica-Bold")))
        for f in findings:
            story.append(Paragraph(f"• {f}", body_style))
        story.append(Spacer(1, 12))

    # Data preview
    story.append(Paragraph("Data Preview (First 10 Rows)", heading_style))
    preview_df = df.head(10).fillna("").astype(str)
    cols = list(preview_df.columns)[:6]  # max 6 cols for readability
    preview_data = [cols] + preview_df[cols].values.tolist()
    col_width = 6.5 * inch / len(cols)
    preview_table = Table(preview_data, colWidths=[col_width] * len(cols))
    preview_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("PADDING", (0, 0), (-1, -1), 3),
        ("TRUNCATE", (0, 0), (-1, -1), True),
    ]))
    story.append(preview_table)

    # Footer note
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0")))
    story.append(Paragraph("Generated by AI Data Analyst Agent", small_style))

    doc.build(story)
    return report_id, pdf_path


@router.post("/datasets/{dataset_id}/report")
def generate_report(dataset_id: str, body: ReportInput):
    d, df = _load_df(dataset_id)
    title = body.title or f"{d['name']} — Data Analysis Report"

    report_id, pdf_path = _generate_pdf(
        d, df, title,
        include_insights=body.includeInsights if body.includeInsights is not None else True,
        include_kpis=body.includeKpis if body.includeKpis is not None else True,
    )

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


@router.get("/reports")
def list_reports():
    reports = store.get_all_reports()
    return [{k: v for k, v in r.items() if k != "pdfPath"} for r in reports]


def _format_size(size_bytes: int) -> str:
    if size_bytes >= 1_000_000:
        return f"{size_bytes / 1_000_000:.1f} MB"
    elif size_bytes >= 1_000:
        return f"{size_bytes / 1_000:.1f} KB"
    return f"{size_bytes} B"


def _format_number(n: float) -> str:
    if abs(n) >= 1_000_000:
        return f"{n/1_000_000:.2f}M"
    elif abs(n) >= 1_000:
        return f"{n/1_000:.1f}K"
    return f"{n:.2f}"
