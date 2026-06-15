import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from routers import datasets, analysis, chat, reports

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/tmp/data_analyst_uploads")
REPORTS_DIR = os.environ.get("REPORTS_DIR", "/tmp/data_analyst_reports")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="AI Data Analyst API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets.router, prefix="/api", tags=["datasets"])
app.include_router(analysis.router, prefix="/api", tags=["analysis"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(reports.router, prefix="/api", tags=["reports"])

os.makedirs(REPORTS_DIR, exist_ok=True)
app.mount("/api/reports/files", StaticFiles(directory=REPORTS_DIR), name="reports_files")


@app.get("/api/healthz")
def health_check():
    return {"status": "ok"}
