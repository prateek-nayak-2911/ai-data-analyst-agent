"""Disk-backed store for datasets, chat history, and reports."""
import os
import json
import threading
from typing import Dict, List, Any, Optional

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/tmp/data_analyst_uploads")
REPORTS_DIR = os.environ.get("REPORTS_DIR", "/tmp/data_analyst_reports")
STATE_DIR = os.environ.get("STATE_DIR", "/tmp/data_analyst_state")

os.makedirs(STATE_DIR, exist_ok=True)

_DATASETS_FILE = os.path.join(STATE_DIR, "datasets.json")
_CHAT_FILE = os.path.join(STATE_DIR, "chat_history.json")
_REPORTS_FILE = os.path.join(STATE_DIR, "reports.json")

_lock = threading.Lock()


def _read_json(path: str, default):
    try:
        with open(path, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def _write_json(path: str, data) -> None:
    with open(path, "w") as f:
        json.dump(data, f)


def get_all_datasets() -> List[dict]:
    with _lock:
        data = _read_json(_DATASETS_FILE, {})
        return list(data.values())


def get_dataset(dataset_id: str) -> Optional[dict]:
    with _lock:
        data = _read_json(_DATASETS_FILE, {})
        return data.get(dataset_id)


def save_dataset(dataset: dict) -> None:
    with _lock:
        data = _read_json(_DATASETS_FILE, {})
        data[dataset["id"]] = dataset
        _write_json(_DATASETS_FILE, data)


def delete_dataset(dataset_id: str) -> bool:
    with _lock:
        data = _read_json(_DATASETS_FILE, {})
        if dataset_id in data:
            del data[dataset_id]
            _write_json(_DATASETS_FILE, data)
            chat = _read_json(_CHAT_FILE, {})
            if dataset_id in chat:
                del chat[dataset_id]
                _write_json(_CHAT_FILE, chat)
            return True
        return False


def get_chat_history(dataset_id: str) -> List[dict]:
    with _lock:
        data = _read_json(_CHAT_FILE, {})
        return data.get(dataset_id, [])


def add_chat_message(dataset_id: str, message: dict) -> None:
    with _lock:
        data = _read_json(_CHAT_FILE, {})
        if dataset_id not in data:
            data[dataset_id] = []
        data[dataset_id].append(message)
        _write_json(_CHAT_FILE, data)


def clear_chat_history(dataset_id: str) -> None:
    with _lock:
        data = _read_json(_CHAT_FILE, {})
        data[dataset_id] = []
        _write_json(_CHAT_FILE, data)


def get_all_reports() -> List[dict]:
    with _lock:
        data = _read_json(_REPORTS_FILE, [])
        return list(reversed(data))


def add_report(report: dict) -> None:
    with _lock:
        data = _read_json(_REPORTS_FILE, [])
        data.append(report)
        _write_json(_REPORTS_FILE, data)
