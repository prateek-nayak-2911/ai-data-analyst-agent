import os
import uuid
import shutil
from datetime import datetime, timezone
from typing import List

import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

import store

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/tmp/data_analyst_uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter()


def _build_column_info(df: pd.DataFrame) -> List[dict]:
    cols = []
    for col in df.columns:
        series = df[col]
        dtype = str(series.dtype)
        null_count = int(series.isna().sum())
        unique_count = int(series.nunique())
        is_numeric = pd.api.types.is_numeric_dtype(series)
        cols.append({
            "name": col,
            "dtype": dtype,
            "nullCount": null_count,
            "uniqueCount": unique_count,
            "min": str(series.min()) if not series.empty else None,
            "max": str(series.max()) if not series.empty else None,
            "mean": float(series.mean()) if is_numeric else None,
            "std": float(series.std()) if is_numeric else None,
        })
    return cols


def _load_dataframe(file_path: str, filename: str) -> pd.DataFrame:
    ext = filename.lower().rsplit(".", 1)[-1]
    if ext == "csv":
        return pd.read_csv(file_path)
    elif ext in ("xlsx", "xls"):
        return pd.read_excel(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


@router.post("/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)):
    filename = file.filename or "upload"
    ext = filename.lower().rsplit(".", 1)[-1]
    if ext not in ("csv", "xlsx", "xls"):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")

    dataset_id = str(uuid.uuid4())
    save_path = os.path.join(UPLOAD_DIR, f"{dataset_id}.{ext}")

    with open(save_path, "wb") as f:
        content = await file.read()
        f.write(content)

    file_size = len(content)

    try:
        df = _load_dataframe(save_path, filename)
    except Exception as e:
        os.remove(save_path)
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    name = filename.rsplit(".", 1)[0]
    dataset = {
        "id": dataset_id,
        "name": name,
        "filename": filename,
        "rowCount": len(df),
        "columnCount": len(df.columns),
        "uploadedAt": datetime.now(timezone.utc).isoformat(),
        "fileSize": file_size,
        "filePath": save_path,
        "columns": _build_column_info(df),
        "previewRows": df.head(5).fillna("").astype(str).to_dict(orient="records"),
    }
    store.save_dataset(dataset)
    return {k: v for k, v in dataset.items() if k != "filePath"}


@router.get("/datasets")
def list_datasets():
    datasets = store.get_all_datasets()
    return [
        {
            "id": d["id"],
            "name": d["name"],
            "filename": d["filename"],
            "rowCount": d["rowCount"],
            "columnCount": d["columnCount"],
            "uploadedAt": d["uploadedAt"],
            "fileSize": d["fileSize"],
        }
        for d in datasets
    ]


@router.get("/datasets/{dataset_id}")
def get_dataset(dataset_id: str):
    d = store.get_dataset(dataset_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {k: v for k, v in d.items() if k != "filePath"}


@router.delete("/datasets/{dataset_id}")
def delete_dataset(dataset_id: str):
    d = store.get_dataset(dataset_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")
    file_path = d.get("filePath")
    if file_path and os.path.exists(file_path):
        os.remove(file_path)
    store.delete_dataset(dataset_id)
    return {"success": True, "message": "Dataset deleted"}
