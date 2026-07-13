from app.models.schemas import PredictionRequest, PredictionResponse


class PlaceholderPredictor:
    def __init__(self, model_path: str):
        self.model_path = model_path

    def predict(self, payload: PredictionRequest) -> PredictionResponse:
        # Fixed contract for future real model replacement.
        return PredictionResponse(
            medicine_id=payload.medicine_id,
            predicted_demand=[20, 25, 30],
            confidence=0.92
        )
