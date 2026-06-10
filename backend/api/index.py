import sys
import traceback

_import_error = None
_app = None

try:
    from app.main import app as _app
except Exception:
    _import_error = traceback.format_exc()


async def app(scope, receive, send):
    if scope["type"] == "lifespan":
        while True:
            msg = await receive()
            if msg["type"] == "lifespan.startup":
                await send({"type": "lifespan.startup.complete"})
            elif msg["type"] == "lifespan.shutdown":
                await send({"type": "lifespan.shutdown.complete"})
                return
        return

    if scope["type"] != "http":
        return

    if _app is not None:
        await _app(scope, receive, send)
        return

    # Return error details as JSON
    body = f'{{"error": "import_failed", "detail": {repr(_import_error)}}}'.encode()
    await send({
        "type": "http.response.start",
        "status": 500,
        "headers": [[b"content-type", b"application/json"]],
    })
    await send({"type": "http.response.body", "body": body})
