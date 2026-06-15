import os
import uuid
from typing import List

import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException

import store

router = APIRouter()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")


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


@router.get("/datasets/{dataset_id}/overview")
def get_overview(dataset_id: str):
    d, df = _load_df(dataset_id)
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
    missing_cells = int(df.isna().sum().sum())
    total_cells = df.shape[0] * df.shape[1]
    missing_pct = round((missing_cells / total_cells) * 100, 2) if total_cells > 0 else 0.0
    duplicate_rows = int(df.duplicated().sum())

    columns = []
    for col in df.columns:
        series = df[col]
        is_num = pd.api.types.is_numeric_dtype(series)
        columns.append({
            "name": col,
            "dtype": str(series.dtype),
            "nullCount": int(series.isna().sum()),
            "uniqueCount": int(series.nunique()),
            "min": str(series.min()) if not series.empty else None,
            "max": str(series.max()) if not series.empty else None,
            "mean": float(series.mean()) if is_num else None,
            "std": float(series.std()) if is_num else None,
        })

    return {
        "rowCount": len(df),
        "columnCount": len(df.columns),
        "missingCells": missing_cells,
        "missingPercent": missing_pct,
        "duplicateRows": duplicate_rows,
        "numericColumns": len(numeric_cols),
        "categoricalColumns": len(categorical_cols),
        "columns": columns,
    }


@router.get("/datasets/{dataset_id}/charts")
def get_charts(dataset_id: str):
    d, df = _load_df(dataset_id)
    charts = []

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()

    # Bar chart: categorical vs numeric
    if categorical_cols and numeric_cols:
        cat_col = categorical_cols[0]
        num_col = numeric_cols[0]
        grouped = df.groupby(cat_col)[num_col].mean().reset_index()
        grouped = grouped.head(15)
        data = grouped.rename(columns={cat_col: "x", num_col: "y"}).to_dict(orient="records")
        charts.append({
            "id": str(uuid.uuid4()),
            "title": f"{num_col} by {cat_col}",
            "chartType": "bar",
            "xAxis": cat_col,
            "yAxis": num_col,
            "description": f"Average {num_col} grouped by {cat_col}",
            "data": _sanitize(data),
        })

    # Line chart: if there's a date/time column or sequential index with numeric
    date_cols = [c for c in df.columns if any(kw in c.lower() for kw in ["date", "time", "year", "month", "day"])]
    if date_cols and numeric_cols:
        date_col = date_cols[0]
        num_col = numeric_cols[0]
        try:
            df_temp = df[[date_col, num_col]].dropna()
            df_temp[date_col] = pd.to_datetime(df_temp[date_col], errors="coerce")
            df_temp = df_temp.dropna().sort_values(date_col).head(50)
            data = [{"x": str(row[date_col])[:10], "y": row[num_col]} for _, row in df_temp.iterrows()]
            charts.append({
                "id": str(uuid.uuid4()),
                "title": f"{num_col} over {date_col}",
                "chartType": "line",
                "xAxis": date_col,
                "yAxis": num_col,
                "description": f"Trend of {num_col} over time",
                "data": _sanitize(data),
            })
        except Exception:
            pass
    elif len(numeric_cols) >= 2:
        # Scatter for two numeric columns
        x_col, y_col = numeric_cols[0], numeric_cols[1]
        sample = df[[x_col, y_col]].dropna().head(200)
        data = [{"x": row[x_col], "y": row[y_col]} for _, row in sample.iterrows()]
        charts.append({
            "id": str(uuid.uuid4()),
            "title": f"{y_col} vs {x_col}",
            "chartType": "scatter",
            "xAxis": x_col,
            "yAxis": y_col,
            "description": f"Relationship between {x_col} and {y_col}",
            "data": _sanitize(data),
        })

    # Pie chart: distribution of a categorical column
    if categorical_cols:
        cat_col = categorical_cols[0]
        counts = df[cat_col].value_counts().head(8).reset_index()
        counts = counts.rename(columns={cat_col: "name", "count": "value"})
        data = counts[["name", "value"]].to_dict(orient="records")
        charts.append({
            "id": str(uuid.uuid4()),
            "title": f"Distribution of {cat_col}",
            "chartType": "pie",
            "xAxis": "name",
            "yAxis": "value",
            "description": f"Proportion of each {cat_col} category",
            "data": _sanitize(data),
        })

    # Second bar chart for second numeric column if available
    if len(numeric_cols) >= 2 and categorical_cols:
        cat_col = categorical_cols[0]
        num_col = numeric_cols[1]
        grouped = df.groupby(cat_col)[num_col].sum().reset_index().head(15)
        data = grouped.rename(columns={cat_col: "x", num_col: "y"}).to_dict(orient="records")
        charts.append({
            "id": str(uuid.uuid4()),
            "title": f"Total {num_col} by {cat_col}",
            "chartType": "bar",
            "xAxis": cat_col,
            "yAxis": num_col,
            "description": f"Sum of {num_col} per {cat_col}",
            "data": _sanitize(data),
        })

    return charts


@router.get("/datasets/{dataset_id}/kpis")
def get_kpis(dataset_id: str):
    d, df = _load_df(dataset_id)
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    kpis = []

    for col in numeric_cols[:6]:
        series = df[col].dropna()
        if series.empty:
            continue
        total = float(series.sum())
        mean = float(series.mean())
        kpis.append({
            "id": str(uuid.uuid4()),
            "label": f"Total {col}",
            "value": _format_number(total),
            "column": col,
            "change": None,
            "trend": None,
        })
        kpis.append({
            "id": str(uuid.uuid4()),
            "label": f"Avg {col}",
            "value": _format_number(mean),
            "column": col,
            "change": None,
            "trend": None,
        })

    kpis.append({
        "id": str(uuid.uuid4()),
        "label": "Total Rows",
        "value": f"{len(df):,}",
        "column": "_rows",
        "change": None,
        "trend": None,
    })

    return kpis[:8]


@router.get("/datasets/{dataset_id}/insights")
def get_insights(dataset_id: str):
    from datetime import datetime, timezone
    d, df = _load_df(dataset_id)

    summary = _build_summary(df, d["name"])

    if not GEMINI_API_KEY:
        insights_text = _fallback_insights(df, d["name"])
        key_findings = _extract_key_findings(df)
    else:
        try:
            from google import genai as new_genai
            client = new_genai.Client(api_key=GEMINI_API_KEY)
            prompt = f"""You are a senior data analyst. Analyze this dataset and provide clear, actionable insights.

Dataset: {d['name']}
{summary}

Please provide:
1. A comprehensive analysis paragraph (3-5 sentences) about key patterns, trends, and notable findings
2. Then list 4-6 specific key findings as bullet points starting with "• "

Be specific with numbers and percentages. Focus on what matters most for business decisions."""

            response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
            full_text = response.text.strip()

            # Split into main insights and key findings
            lines = full_text.split("\n")
            main_lines = []
            finding_lines = []
            for line in lines:
                if line.strip().startswith("•") or line.strip().startswith("-") or line.strip().startswith("*"):
                    finding_lines.append(line.strip().lstrip("•-* ").strip())
                else:
                    main_lines.append(line)

            insights_text = "\n".join(main_lines).strip()
            key_findings = finding_lines[:6] if finding_lines else _extract_key_findings(df)
        except Exception as e:
            insights_text = _fallback_insights(df, d["name"])
            key_findings = _extract_key_findings(df)

    return {
        "insights": insights_text,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "keyFindings": key_findings,
    }


def _build_summary(df: pd.DataFrame, name: str) -> str:
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
    lines = [
        f"Rows: {len(df)}, Columns: {len(df.columns)}",
        f"Numeric columns: {', '.join(numeric_cols[:5])}",
        f"Categorical columns: {', '.join(categorical_cols[:5])}",
        f"Missing values: {int(df.isna().sum().sum())}",
    ]
    for col in numeric_cols[:3]:
        s = df[col].dropna()
        lines.append(f"{col}: min={s.min():.2f}, max={s.max():.2f}, mean={s.mean():.2f}, std={s.std():.2f}")
    for col in categorical_cols[:2]:
        top = df[col].value_counts().head(3)
        lines.append(f"{col} top values: {', '.join([f'{k}({v})' for k,v in top.items()])}")
    return "\n".join(lines)


def _fallback_insights(df: pd.DataFrame, name: str) -> str:
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
    missing = int(df.isna().sum().sum())
    missing_pct = round(missing / (df.shape[0] * df.shape[1]) * 100, 1)
    parts = [
        f"The {name} dataset contains {len(df):,} rows and {len(df.columns)} columns.",
        f"There are {len(numeric_cols)} numeric and {len(cat_cols)} categorical columns.",
    ]
    if missing > 0:
        parts.append(f"Data quality shows {missing:,} missing values ({missing_pct}% of cells).")
    if numeric_cols:
        col = numeric_cols[0]
        s = df[col].dropna()
        parts.append(f"The {col} column ranges from {s.min():.2f} to {s.max():.2f} with a mean of {s.mean():.2f}.")
    return " ".join(parts)


def _extract_key_findings(df: pd.DataFrame) -> list:
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
    findings = [
        f"Dataset has {len(df):,} records across {len(df.columns)} features",
        f"Found {int(df.isna().sum().sum())} missing values in total",
        f"Contains {len(numeric_cols)} numeric and {len(cat_cols)} categorical columns",
        f"Duplicate rows: {int(df.duplicated().sum())}",
    ]
    for col in numeric_cols[:2]:
        s = df[col].dropna()
        findings.append(f"{col}: average is {s.mean():.2f}, ranging {s.min():.2f}–{s.max():.2f}")
    return findings[:6]


def _format_number(n: float) -> str:
    if abs(n) >= 1_000_000:
        return f"{n/1_000_000:.2f}M"
    elif abs(n) >= 1_000:
        return f"{n/1_000:.1f}K"
    else:
        return f"{n:.2f}"


def _sanitize(data: list) -> list:
    """Replace NaN/inf with None and cast numpy types for JSON serialization."""
    import math
    import numpy as np
    result = []
    for row in data:
        clean = {}
        for k, v in row.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                clean[k] = None
            elif isinstance(v, (np.integer,)):
                clean[k] = int(v)
            elif isinstance(v, (np.floating,)):
                clean[k] = None if (math.isnan(float(v)) or math.isinf(float(v))) else float(v)
            elif isinstance(v, np.bool_):
                clean[k] = bool(v)
            else:
                clean[k] = v
        result.append(clean)
    return result
