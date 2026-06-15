#!/bin/bash
cd /home/runner/workspace/artifacts/api-server/python_backend
export PYTHONPATH=/home/runner/workspace/artifacts/api-server/python_backend
exec python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
