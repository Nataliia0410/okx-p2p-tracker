from fastapi import FastAPI
from mangum import Mangum

_app = FastAPI()

@_app.get("/api/ping")
def ping():
    return {"ok": True}

handler = Mangum(_app, lifespan="off")
