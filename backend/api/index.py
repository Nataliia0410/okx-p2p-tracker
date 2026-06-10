import os
import traceback
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

# Minimal FastAPI app — full app loaded lazily to surface import errors
_error_detail = None
_full_app = None


def _load_full_app():
    global _full_app, _error_detail
    if _full_app is not None:
        return _full_app
    try:
        from app.main import app as _a
        _full_app = _a
    except Exception:
        _error_detail = traceback.format_exc()
    return _full_app


_fallback = FastAPI()
_fallback.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@_fallback.get("/api/health")
def health():
    app = _load_full_app()
    if app is None:
        return {"status": "error", "detail": _error_detail}
    return {"status": "ok"}


@_fallback.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy(path: str):
    app = _load_full_app()
    if app is None:
        from fastapi import HTTPException
        raise HTTPException(500, detail=_error_detail)
    # Delegate to full app's router
    from fastapi import Request
    return {"error": "use full app", "loaded": app is not None}


handler = Mangum(_fallback, lifespan="off")
