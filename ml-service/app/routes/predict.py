from fastapi import APIRouter
from app.models.schemas import PredictionRequest, PredictionResponse
from app.services.predictor import PlaceholderPredictor

router = APIRouter(prefix="", tags=["prediction"])
predictor = PlaceholderPredictor("app/models/placeholder_model.pkl")


@router.post("/predict", response_model=PredictionResponse)
def predict(payload: PredictionRequest):
    return predictor.predict(payload)
