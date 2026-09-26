from pydantic import BaseModel, Field
from typing import Optional, Union, List


class PredictionRequest(BaseModel):
    medicine_id: Union[int, str]
    category: Optional[str] = Field(default=None, description="ATC Category (e.g. R06, M01AB, N02BE)")
    target_month: Optional[int] = Field(default=None, ge=1, le=12, description="Target calendar month (1-12)")
    periods: Optional[int] = Field(default=30, ge=1, le=365, description="Number of days to forecast")
    pharmacy_baseline: Optional[float] = Field(default=None, ge=0.0, description="Pharmacy completed monthly sales baseline")


class PredictionResponse(BaseModel):
    medicine_id: Union[int, str]
    category: Optional[str] = None
    normalized_demand_factor: float = Field(default=1.0, description="Learned seasonal relative demand factor")
    predicted_demand: List[int]
    total_demand: int
    confidence: float
    periods: int
    source: str = "ml-service"
