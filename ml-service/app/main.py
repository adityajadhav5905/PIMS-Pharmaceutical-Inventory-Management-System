from fastapi import FastAPI
from app.routes.predict import router as predict_router

app = FastAPI(title="Medical Inventory ML Service", version="1.0.0")


@app.get("/health")
def health_check():
    return {"ok": True}


app.include_router(predict_router)
