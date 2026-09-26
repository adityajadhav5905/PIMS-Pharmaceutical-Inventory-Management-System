"""
Normalization & Target Construction Module.

Designs mathematically sound normalization methods for relative demand factor forecasting:
1. Trailing 3-Month Ratio (T3MA): F_t = Y_t / mean(Y_{t-3..t-1})
   - Matches the operational pharmacy scale definition: baseline = avg(last 3 months).
2. Trailing 12-Month Ratio (T12MA): F_t = Y_t / mean(Y_{t-12..t-1})
   - Classical annual baseline: ratio to preceding 12-month average rate.
3. Expanding Window Mean Ratio (EMR): F_t = Y_t / mean(Y_{1..t-1})

All methods strictly avoid future-data leakage by computing baselines from strictly past observations.
"""

import pandas as pd
import numpy as np
from typing import Tuple, Dict


def compute_normalized_factors(series: pd.Series, method: str = "T3MA") -> Tuple[pd.Series, pd.Series]:
    """
    Computes baseline and normalized target factor for a given category series.
    
    Returns:
        (baselines, factors)
        where factor_t = series_t / baseline_t
    """
    values = series.values.astype(float)
    n = len(values)
    baselines = np.full(n, np.nan)
    factors = np.full(n, np.nan)
    
    if method == "T3MA":
        # Trailing 3-month average: mean of t-3, t-2, t-1
        for t in range(3, n):
            base = np.mean(values[t-3:t])
            baselines[t] = base
            if base > 1e-6:
                factors[t] = values[t] / base
            else:
                factors[t] = 1.0
                
    elif method == "T12MA":
        # Trailing 12-month average: mean of t-12 ... t-1
        for t in range(12, n):
            base = np.mean(values[t-12:t])
            baselines[t] = base
            if base > 1e-6:
                factors[t] = values[t] / base
            else:
                factors[t] = 1.0
                
    elif method == "EMR":
        # Expanding mean: mean of 0 ... t-1
        for t in range(3, n):
            base = np.mean(values[:t])
            baselines[t] = base
            if base > 1e-6:
                factors[t] = values[t] / base
            else:
                factors[t] = 1.0
    else:
        raise ValueError(f"Unknown normalization method: {method}")
        
    return pd.Series(baselines, index=series.index), pd.Series(factors, index=series.index)


def evaluate_normalization_properties(df: pd.DataFrame, categories: list) -> pd.DataFrame:
    """
    Analyzes mathematical properties (variance, mean, stability) across normalization methods.
    """
    records = []
    for cat in categories:
        s = df[cat]
        for m in ["T3MA", "T12MA", "EMR"]:
            _, factors = compute_normalized_factors(s, method=m)
            valid = factors.dropna()
            records.append({
                "Category": cat,
                "Method": m,
                "Valid_Points": len(valid),
                "Mean_Factor": round(float(valid.mean()), 3),
                "Std_Factor": round(float(valid.std()), 3),
                "Min_Factor": round(float(valid.min()), 3),
                "Max_Factor": round(float(valid.max()), 3),
                "Median_Factor": round(float(valid.median()), 3),
            })
    return pd.DataFrame(records)


if __name__ == "__main__":
    from data_prep import load_raw_dataset, clean_dataset, ATC_CATEGORIES
    raw = load_raw_dataset()
    cleaned = clean_dataset(raw)
    stats_df = evaluate_normalization_properties(cleaned, ATC_CATEGORIES)
    print("Normalization methods summary statistics across ATC categories:")
    print(stats_df.to_string())
