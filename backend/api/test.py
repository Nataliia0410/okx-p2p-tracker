from fastapi import FastAPI
from mangum import Mangum

app_inner = FastAPI()

@app_inner.get("/api/ping")
def ping():
    return {"ok": True}

handler = Mangum(app_inner, lifespan="off")
