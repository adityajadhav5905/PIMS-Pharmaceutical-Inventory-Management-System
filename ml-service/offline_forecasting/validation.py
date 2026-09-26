"""
Rolling / Expanding Window Validation Engine.

Strict chronological 1-step-ahead backtesting with zero future leakage.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Any
from models import (
    SeasonalHistoricalIndexModel,
    HoltWintersModel,
    SarimaModel,
    LagRidgeRegressionModel
)
from normalization import compute_normalized_factors


def calculate_metrics(actuals: np.ndarray, predictions: np.ndarray) -> Dict[str, float]:
    """Calculate MAE, RMSE, sMAPE, and MAPE."""
    actuals = np.array(actuals)
    predictions = np.array(predictions)
    
    errors = predictions - actuals
    abs_errors = np.abs(errors)
    
    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean(errors ** 2)))
    
    # sMAPE: symmetric mean absolute percentage error
    denom = (np.abs(actuals) + np.abs(predictions)) / 2.0
    denom = np.where(denom == 0, 1e-6, denom)
    smape = float(np.mean(abs_errors / denom) * 100.0)
    
    # Standard MAPE with small epsilon protection
    actuals_safe = np.where(actuals == 0, 1e-6, actuals)
    mape = float(np.mean(abs_errors / np.abs(actuals_safe)) * 100.0)
    
    return {
        "MAE": round(mae, 4),
        "RMSE": round(rmse, 4),
        "sMAPE": round(smape, 2),
        "MAPE": round(mape, 2)
    }


def run_rolling_backtest_for_category(
    df: pd.DataFrame,
    category: str,
    norm_method: str = "T3MA",
    warmup_months: int = 36
) -> Dict[str, Any]:
    """
    Simulates chronological 1-step-ahead backtest across candidate models:
    - Seasonal Historical Index (SHI)
    - Holt-Winters Exponential Smoothing (HW-ES)
    - SARIMA
    - Lag-based Ridge Regression (Ridge-Lag)
    """
    raw_series = df[category].values.astype(float)
    months = df["month"].values
    n = len(raw_series)
    
    # Precompute actual factors for evaluation
    _, actual_factors = compute_normalized_factors(df[category], method=norm_method)
    actual_factors = actual_factors.values
    
    # Results collectors
    models = {
        "SHI_Mean": SeasonalHistoricalIndexModel(use_median=False),
        "SHI_Median": SeasonalHistoricalIndexModel(use_median=True),
        "HW_Additive": HoltWintersModel(seasonal="add", trend="add"),
        "HW_Damped": HoltWintersModel(seasonal="add", trend="add", damped_trend=True),
        "SARIMA_(1,0,0)x(0,1,0)": SarimaModel(order=(1, 0, 0), seasonal_order=(0, 1, 0, 12)),
        "SARIMA_(0,1,1)x(0,1,1)": SarimaModel(order=(0, 1, 1), seasonal_order=(0, 1, 1, 12)),
        "Ridge_Lag": LagRidgeRegressionModel(alpha=1.0)
    }
    
    predictions = {name: [] for name in models}
    ground_truth = []
    test_dates = []
    
    # Rolling test loop from warmup_months to n (all completed months through 2019-09)
    for t in range(warmup_months, n):
        # Exclude outage month 2017-01 from test evaluation metrics to prevent contamination
        date_t = df.loc[t, "datum"]
        if date_t.year == 2017 and date_t.month == 1:
            continue
            
        if np.isnan(actual_factors[t]):
            continue
            
        target_month = months[t]
        y_true = actual_factors[t]
        ground_truth.append(y_true)
        test_dates.append(date_t)
        
        # Historical slice up to t-1
        train_y = raw_series[:t]
        train_months = months[:t]
        
        # Calculate baseline for target step t
        if norm_method == "T3MA":
            base_t = np.mean(train_y[-3:])
        elif norm_method == "T12MA":
            base_t = np.mean(train_y[-12:])
        else:
            base_t = np.mean(train_y)
            
        # Re-derive factors on train slice
        _, train_factors = compute_normalized_factors(pd.Series(train_y), method=norm_method)
        train_factors = train_factors.values
        
        # 1. SHI Mean
        m_shi_mean = SeasonalHistoricalIndexModel(use_median=False)
        m_shi_mean.fit(train_months, train_factors)
        predictions["SHI_Mean"].append(m_shi_mean.predict_factor(target_month))
        
        # 2. SHI Median
        m_shi_med = SeasonalHistoricalIndexModel(use_median=True)
        m_shi_med.fit(train_months, train_factors)
        predictions["SHI_Median"].append(m_shi_med.predict_factor(target_month))
        
        # 3. HW Additive
        m_hw_add = HoltWintersModel(seasonal="add", trend="add")
        predictions["HW_Additive"].append(m_hw_add.fit_predict_next(train_y, base_t))
        
        # 4. HW Damped
        m_hw_damp = HoltWintersModel(seasonal="add", trend="add", damped_trend=True)
        predictions["HW_Damped"].append(m_hw_damp.fit_predict_next(train_y, base_t))
        
        # 5. SARIMA (1,0,0)x(0,1,0)
        m_sarima1 = SarimaModel(order=(1, 0, 0), seasonal_order=(0, 1, 0, 12))
        predictions["SARIMA_(1,0,0)x(0,1,0)"].append(m_sarima1.fit_predict_next(train_y, base_t))
        
        # 6. SARIMA (0,1,1)x(0,1,1)
        m_sarima2 = SarimaModel(order=(0, 1, 1), seasonal_order=(0, 1, 1, 12))
        predictions["SARIMA_(0,1,1)x(0,1,1)"].append(m_sarima2.fit_predict_next(train_y, base_t))
        
        # 7. Ridge Lag
        m_ridge = LagRidgeRegressionModel(alpha=1.0)
        predictions["Ridge_Lag"].append(m_ridge.fit_predict_next(train_months, train_factors, target_month))

    # Evaluate metrics
    results = {}
    gt_arr = np.array(ground_truth)
    for name, preds in predictions.items():
        metrics = calculate_metrics(gt_arr, np.array(preds))
        results[name] = {
            **metrics,
            "Predictions": preds
        }
        
    return {
        "Category": category,
        "Norm_Method": norm_method,
        "Test_Points": len(ground_truth),
        "Dates": test_dates,
        "Ground_Truth": ground_truth,
        "Model_Results": results
    }
