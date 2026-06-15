import os
import uuid
from datetime import datetime, timezone
from typing import List

import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import store

router = APIRouter()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")


class ChatMessageInput(BaseModel):
    message: str


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


def _build_context(d: dict, df: pd.DataFrame) -> str:
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
    lines = [
        f"Dataset: {d['name']} ({d['filename']})",
        f"Shape: {len(df)} rows x {len(df.columns)} columns",
        f"Columns: {', '.join(df.columns.tolist())}",
        f"Numeric: {', '.join(numeric_cols)}",
        f"Categorical: {', '.join(cat_cols)}",
        "",
        "Sample data (first 5 rows):",
        df.head(5).to_string(),
        "",
        "Statistics:",
    ]
    for col in numeric_cols[:5]:
        s = df[col].dropna()
        lines.append(f"  {col}: min={s.min():.2f}, max={s.max():.2f}, mean={s.mean():.2f}")
    for col in cat_cols[:3]:
        top = df[col].value_counts().head(3)
        lines.append(f"  {col} top values: {list(top.index)}")
    return "\n".join(lines)


@router.post("/datasets/{dataset_id}/chat")
def chat_with_dataset(dataset_id: str, body: ChatMessageInput):
    d, df = _load_df(dataset_id)
    history = store.get_chat_history(dataset_id)

    user_msg = {
        "id": str(uuid.uuid4()),
        "role": "user",
        "content": body.message,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    store.add_chat_message(dataset_id, user_msg)

    dataset_context = _build_context(d, df)

    if not GEMINI_API_KEY:
        response_text = (
            f"I can see your dataset '{d['name']}' has {len(df)} rows and {len(df.columns)} columns. "
            f"To enable full AI-powered chat, please provide a GEMINI_API_KEY environment variable. "
            f"Your question was: {body.message}"
        )
    else:
        try:
            system_prompt = f"""You are an expert data analyst assistant. You have access to a dataset with the following information:

{dataset_context}

Answer questions about this data clearly and concisely. When relevant, provide specific numbers, statistics, or patterns you can derive from the data summary provided. If asked to perform calculations, do them step by step."""

            from google import genai as new_genai
            from google.genai import types as genai_types
            client = new_genai.Client(api_key=GEMINI_API_KEY)

            contents = []
            for msg in history[-10:]:
                role = "user" if msg["role"] == "user" else "model"
                contents.append(genai_types.Content(role=role, parts=[genai_types.Part(text=msg["content"])]))
            contents.append(genai_types.Content(role="user", parts=[genai_types.Part(text=body.message)]))

            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=contents,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    max_output_tokens=2048,
                ),
            )
            response_text = response.text.strip()
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                response_text = (
                    f"The AI service is temporarily rate-limited. Based on the dataset summary, here's what I can tell you: "
                    f"The '{d['name']}' dataset has {len(df)} rows and {len(df.columns)} columns. "
                    f"Your question was: {body.message}"
                )
            else:
                response_text = f"I encountered an error processing your question: {err_str}. Please try again."

    assistant_msg = {
        "id": str(uuid.uuid4()),
        "role": "assistant",
        "content": response_text,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    store.add_chat_message(dataset_id, assistant_msg)

    return assistant_msg


@router.get("/datasets/{dataset_id}/chat/history")
def get_chat_history(dataset_id: str):
    d = store.get_dataset(dataset_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return store.get_chat_history(dataset_id)


@router.delete("/datasets/{dataset_id}/chat/history")
def clear_chat_history(dataset_id: str):
    d = store.get_dataset(dataset_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")
    store.clear_chat_history(dataset_id)
    return {"success": True, "message": "Chat history cleared"}
