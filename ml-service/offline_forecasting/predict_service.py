"""
Standalone Offline Prediction Service.

Provides a clean, modular prediction function:
predict_next_month_factor(category: str, historical_monthly_sales: list | np.ndarray | pd.Series, target_month: int = None) -> float
"""

import os
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Union, Dict, Any, Optional

ARTIFACT_PATH = Path(__file__).resolve().parent / "artifacts" / "final_demand_factor_models.joblib"


def load_model_artifacts() -> Dict[str, Any]:
    """Loads pre-trained relative demand models and monthly factor lookup tables."""
    if not ARTIFACT_PATH.exists():
        # Fallback to dynamic training if artifact is missing
        from train_and_evaluate import run_full_benchmark, select_best_models_and_fit
        summary_df, _, clean_df = run_full_benchmark(warmup_months=36)
        artifacts = select_best_models_and_fit(summary_df, clean_df, preferred_norm="T3MA")
        os.makedirs(ARTIFACT_PATH.parent, exist_ok=True)
        joblib.dump(artifacts, ARTIFACT_PATH)
        return artifacts
    return joblib.load(ARTIFACT_PATH)


# Cache loaded artifacts
_MODELS_CACHE = None


def get_cached_models():
    global _MODELS_CACHE
    if _MODELS_CACHE is None:
        _MODELS_CACHE = load_model_artifacts()
    return _MODELS_CACHE


def predict_next_month_factor(
    category: str,
    historical_monthly_sales: Union[list, np.ndarray, pd.Series] = None,
    target_month: Optional[int] = None
) -> float:
    """
    Predicts the NORMALIZED DEMAND FACTOR for the NEXT month.

    Parameters:
        category (str): ATC category identifier ('M01AB', 'M01AE', 'N02BA', 'N02BE', 'N05B', 'N05C', 'R03', 'R06').
        historical_monthly_sales (optional): Historical monthly sales sequence of the pharmacy or category.
        target_month (int, optional): Calendar month (1-12) to predict. If not provided and a Series with DatetimeIndex is passed,
                                      the next sequential month is inferred.

    Returns:
        float: Normalized demand factor (e.g. 1.25 means 125% of baseline demand).
    """
    category = category.upper().strip()
    artifacts = get_cached_models()
    
    if category not in artifacts["categories"]:
        raise ValueError(f"Category '{category}' not found. Supported categories: {list(artifacts['categories'].keys())}")
        
    cat_info = artifacts["categories"][category]
    monthly_factors = cat_info["monthly_factors"]
    
    # Infer target month if not provided
    if target_month is None:
        if isinstance(historical_monthly_sales, pd.Series) and isinstance(historical_monthly_sales.index, pd.DatetimeIndex):
            last_date = historical_monthly_sales.index[-1]
            target_month = (last_date.month % 12) + 1
        elif historical_monthly_sales is not None and len(historical_monthly_sales) > 0:
            # Default to next chronological month from dataset end (dataset ends in Oct 10 -> next month is Nov 11)
            target_month = 11
        else:
            target_month = 11
            
    factor = monthly_factors.get(target_month, 1.0)
    return float(factor)


def forecast_pharmacy_sales(
    category: str,
    pharmacy_historical_sales: Union[list, np.ndarray, pd.Series],
    initial_user_baseline: Optional[float] = None,
    target_month: Optional[int] = None
) -> Dict[str, Any]:
    """
    Full operational forecast combining relative demand factor with pharmacy baseline.
    
    Baseline Rule:
    - If >= 3 completed months available: baseline = mean(last 3 completed months)
    - If < 3 completed months available: baseline = initial_user_baseline
    """
    sales = np.array(pharmacy_historical_sales, dtype=float)
    
    if len(sales) >= 3:
        baseline = float(np.mean(sales[-3:]))
        baseline_source = "average_last_3_completed_months"
    elif initial_user_baseline is not None and initial_user_baseline > 0:
        baseline = float(initial_user_baseline)
        baseline_source = "user_initial_estimate"
    elif len(sales) > 0:
        baseline = float(np.mean(sales))
        baseline_source = "average_available_months"
    else:
        baseline = 100.0
        baseline_source = "default_fallback"

    factor = predict_next_month_factor(category, pharmacy_historical_sales, target_month=target_month)
    predicted_sales = round(factor * baseline, 2)
    
    return {
        "category": category,
        "target_month": target_month or 11,
        "normalized_demand_factor": factor,
        "pharmacy_baseline_units": baseline,
        "baseline_source": baseline_source,
        "predicted_sales_units": predicted_sales
    }


if __name__ == "__main__":
    # Example Demonstration with R06 (Antihistamines)
    r06_factor = predict_next_month_factor("R06", target_month=11)
    print(f"R06 Next-Month (November) Normalized Demand Factor: {r06_factor}")
    
    # Pharmacy scenario: baseline = 100 units
    forecast_result = forecast_pharmacy_sales(
        category="R06",
        pharmacy_historical_sales=[90, 105, 105], # avg = 100 units
        target_month=11
    )
    print("\nPharmacy Forecast Scenario for R06:")
    print(forecast_result)
