from pydantic import BaseModel


class PredictionRequest(BaseModel):
    medicine_id: str


class PredictionResponse(BaseModel):
    medicine_id: str
    predicted_demand: list[int]
    confidence: float
