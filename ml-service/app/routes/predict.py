from fastapi import APIRouter
from app.models.schemas import PredictionRequest, PredictionResponse
from app.services.predictor import TimeSeriesPredictor

router = APIRouter(prefix="", tags=["prediction"])
predictor = TimeSeriesPredictor()


@router.post("/predict", response_model=PredictionResponse)
def predict(payload: PredictionRequest):
    return predictor.predict(payload)

