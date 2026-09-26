"""
Time-Series Models for Relative Demand Forecasting.

Implements candidate model architectures:
1. Seasonal Historical Index (SHI)
2. Holt-Winters Exponential Smoothing (HW-ES)
3. SARIMA / SARIMAX
4. Lag-Based Ridge Regression with Month Dummies (Ridge-Lag)
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, Optional
import warnings
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.statespace.sarimax import SARIMAX
from sklearn.linear_model import Ridge

warnings.filterwarnings("ignore")


class SeasonalHistoricalIndexModel:
    """
    Model 1: Seasonal Historical Index Baseline.
    Computes empirical monthly demand factors for each calendar month (1..12)
    using historical training data.
    """
    def __init__(self, use_median: bool = False):
        self.use_median = use_median
        self.monthly_factors: Dict[int, float] = {}
        self.global_factor: float = 1.0

    def fit(self, train_months: np.ndarray, train_factors: np.ndarray):
        valid = ~np.isnan(train_factors)
        months = train_months[valid]
        factors = train_factors[valid]

        self.monthly_factors = {}
        if len(factors) > 0:
            self.global_factor = float(np.median(factors) if self.use_median else np.mean(factors))
        else:
            self.global_factor = 1.0

        for m in range(1, 13):
            m_factors = factors[months == m]
            if len(m_factors) > 0:
                self.monthly_factors[m] = float(np.median(m_factors) if self.use_median else np.mean(m_factors))
            else:
                self.monthly_factors[m] = self.global_factor
        return self

    def predict_factor(self, target_month: int) -> float:
        return self.monthly_factors.get(target_month, self.global_factor)


class HoltWintersModel:
    """
    Model 2: Holt-Winters Exponential Smoothing.
    Fits level, trend, and seasonal components (period=12) on raw series,
    forecasts 1-step-ahead sales, and normalizes by the trailing baseline.
    """
    def __init__(self, seasonal: str = "add", trend: Optional[str] = "add", damped_trend: bool = False):
        self.seasonal = seasonal
        self.trend = trend
        self.damped_trend = damped_trend
        self.fitted_model = None

    def fit_predict_next(self, train_series: np.ndarray, baseline_next: float) -> float:
        n = len(train_series)
        if n < 24:
            return 1.0

        try:
            hw = ExponentialSmoothing(
                train_series,
                seasonal_periods=12,
                trend=self.trend,
                seasonal=self.seasonal,
                damped_trend=self.damped_trend,
                initialization_method="heuristic"
            )
            self.fitted_model = hw.fit(optimized=False)
            pred_val = float(self.fitted_model.forecast(1)[0])
            pred_val = max(0.0, pred_val)
            if baseline_next > 1e-6:
                return float(pred_val / baseline_next)
            return 1.0
        except Exception:
            return 1.0


class SarimaModel:
    """
    Model 3: Seasonal ARIMA (SARIMA).
    Fits (p,d,q) x (P,D,Q)_12 on historical series and divides 1-step-ahead forecast by baseline.
    """
    def __init__(self, order=(1, 0, 0), seasonal_order=(0, 1, 0, 12)):
        self.order = order
        self.seasonal_order = seasonal_order

    def fit_predict_next(self, train_series: np.ndarray, baseline_next: float) -> float:
        n = len(train_series)
        if n < 24:
            return 1.0

        try:
            model = SARIMAX(
                train_series,
                order=self.order,
                seasonal_order=self.seasonal_order,
                enforce_stationarity=False,
                enforce_invertibility=False
            )
            res = model.fit(disp=False, maxiter=10)
            pred_val = float(res.forecast(1)[0])
            pred_val = max(0.0, pred_val)
            if baseline_next > 1e-6:
                return float(pred_val / baseline_next)
            return 1.0
        except Exception:
            return 1.0




class LagRidgeRegressionModel:
    """
    Model 4: Lag-based Ridge Regression with Monthly Dummy Indicators.
    Features: 12 one-hot month indicators, lag-1 factor, lag-2 factor, lag-12 factor.
    """
    def __init__(self, alpha: float = 1.0):
        self.alpha = alpha
        self.model = Ridge(alpha=alpha, fit_intercept=True)
        self.fitted = False

    def _build_features(self, months: np.ndarray, factors: np.ndarray):
        X = []
        y = []
        n = len(factors)
        for t in range(12, n):
            if np.isnan(factors[t]) or np.isnan(factors[t-1]) or np.isnan(factors[t-2]) or np.isnan(factors[t-12]):
                continue
            # Month dummy vector (1..12)
            month_vec = [1.0 if months[t] == m else 0.0 for m in range(1, 13)]
            lags = [factors[t-1], factors[t-2], factors[t-12]]
            X.append(month_vec + lags)
            y.append(factors[t])
        return np.array(X), np.array(y)

    def fit_predict_next(self, train_months: np.ndarray, train_factors: np.ndarray, target_month: int) -> float:
        n = len(train_factors)
        if n < 24:
            return 1.0

        X, y = self._build_features(train_months, train_factors)
        if len(X) < 10:
            return 1.0

        self.model.fit(X, y)
        
        # Build feature vector for target step (n)
        month_vec = [1.0 if target_month == m else 0.0 for m in range(1, 13)]
        lag1 = train_factors[-1] if not np.isnan(train_factors[-1]) else 1.0
        lag2 = train_factors[-2] if not np.isnan(train_factors[-2]) else 1.0
        lag12 = train_factors[-12] if len(train_factors) >= 12 and not np.isnan(train_factors[-12]) else 1.0
        
        X_next = np.array([month_vec + [lag1, lag2, lag12]])
        pred = float(self.model.predict(X_next)[0])
        return max(0.1, min(3.0, pred))
