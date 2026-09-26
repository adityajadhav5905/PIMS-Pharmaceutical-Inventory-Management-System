"""
Comprehensive Model Benchmark, Selection and Artifact Serialization Engine.

Runs rolling time-series backtests across all 8 ATC categories and candidate models.
Selects optimal model per category based on out-of-sample MAE & sMAPE.
Serializes trained artifacts for production consumption.
"""

import os
import joblib
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Any, Tuple

from data_prep import load_raw_dataset, clean_dataset, ATC_CATEGORIES, CATEGORY_DESCRIPTIONS
from normalization import compute_normalized_factors
from validation import run_rolling_backtest_for_category
from models import (
    SeasonalHistoricalIndexModel,
    HoltWintersModel,
    SarimaModel,
    LagRidgeRegressionModel
)


def run_full_benchmark(warmup_months: int = 36) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    raw_df = load_raw_dataset()
    clean_df = clean_dataset(raw_df)
    
    records = []
    category_backtests = {}
    
    print(f"Starting Benchmark on {len(clean_df)} monthly records across {len(ATC_CATEGORIES)} categories...")
    print(f"Warmup Training Period: First {warmup_months} months (2014-01 to 2016-12)")
    print(f"Backtest Evaluation Period: {len(clean_df) - 1 - warmup_months} out-of-sample test months (2017-01 to 2019-09)\n")
    
    for cat in ATC_CATEGORIES:
        print(f"Evaluating Category: {cat} ({CATEGORY_DESCRIPTIONS.get(cat, '')[:40]}...)...")
        # Run backtest with primary T3MA normalization (and compare T12MA)
        res_t3ma = run_rolling_backtest_for_category(clean_df, cat, norm_method="T3MA", warmup_months=warmup_months)
        res_t12ma = run_rolling_backtest_for_category(clean_df, cat, norm_method="T12MA", warmup_months=warmup_months)
        
        category_backtests[cat] = {
            "T3MA": res_t3ma,
            "T12MA": res_t12ma
        }
        
        for model_name, m_res in res_t3ma["Model_Results"].items():
            records.append({
                "Category": cat,
                "Norm_Method": "T3MA (Operational Baseline)",
                "Model": model_name,
                "MAE": m_res["MAE"],
                "RMSE": m_res["RMSE"],
                "sMAPE (%)": m_res["sMAPE"],
                "MAPE (%)": m_res["MAPE"]
            })
            
        for model_name, m_res in res_t12ma["Model_Results"].items():
            records.append({
                "Category": cat,
                "Norm_Method": "T12MA (Annual Baseline)",
                "Model": model_name,
                "MAE": m_res["MAE"],
                "RMSE": m_res["RMSE"],
                "sMAPE (%)": m_res["sMAPE"],
                "MAPE (%)": m_res["MAPE"]
            })
            
    summary_df = pd.DataFrame(records)
    return summary_df, category_backtests, clean_df


def select_best_models_and_fit(
    summary_df: pd.DataFrame,
    clean_df: pd.DataFrame,
    preferred_norm: str = "T3MA"
) -> Dict[str, Any]:
    """
    Selects the best performing model per category (by lowest MAE on out-of-sample backtest),
    fits on all available historical data (through 2019-09/10), and extracts monthly factors.
    """
    selected_models = {}
    fitted_artifacts = {
        "metadata": {
            "dataset": "sales_monthly.csv",
            "observation_count": len(clean_df),
            "date_range": f"{clean_df['datum'].min().date()} to {clean_df['datum'].max().date()}",
            "normalization_method": preferred_norm
        },
        "categories": {}
    }
    
    # Filter by preferred normalization method for deployment
    df_pref = summary_df[summary_df["Norm_Method"].str.startswith(preferred_norm)]
    
    for cat in ATC_CATEGORIES:
        cat_df = df_pref[df_pref["Category"] == cat].sort_values("MAE")
        best_row = cat_df.iloc[0]
        best_model_name = best_row["Model"]
        
        # Fit final model on complete verified historical series (69 full completed months through 2019-09)
        full_series = clean_df[cat].values.astype(float)
        full_months = clean_df["month"].values
        
        _, full_factors = compute_normalized_factors(pd.Series(full_series), method=preferred_norm)
        
        # Fit SHI model for empirical factors
        final_shi = SeasonalHistoricalIndexModel(use_median="Median" in best_model_name)
        final_shi.fit(full_months, full_factors.values)
        
        monthly_table = {m: round(final_shi.predict_factor(m), 4) for m in range(1, 13)}
        
        # Compute next-month factor (e.g. for November month 11)
        next_month_11 = monthly_table[11]
        
        fitted_artifacts["categories"][cat] = {
            "description": CATEGORY_DESCRIPTIONS.get(cat, ""),
            "selected_model": best_model_name,
            "validation_mae": float(best_row["MAE"]),
            "validation_rmse": float(best_row["RMSE"]),
            "validation_smape": float(best_row["sMAPE (%)"]),
            "monthly_factors": monthly_table,
            "next_month_factor_nov": next_month_11
        }
        
    return fitted_artifacts


if __name__ == "__main__":
    summary_df, backtests, clean_df = run_full_benchmark(warmup_months=36)
    
    print("\n" + "="*80)
    print("FULL OUT-OF-SAMPLE BENCHMARK SUMMARY (TOP MODELS PER CATEGORY):")
    print("="*80)
    
    best_t3ma = summary_df[summary_df["Norm_Method"].str.startswith("T3MA")].sort_values(["Category", "MAE"])
    print(best_t3ma.groupby("Category").first()[["Model", "MAE", "RMSE", "sMAPE (%)", "MAPE (%)"]].to_string())
    
    artifacts = select_best_models_and_fit(summary_df, clean_df, preferred_norm="T3MA")
    
    # Save artifacts
    out_dir = Path(__file__).resolve().parent / "artifacts"
    os.makedirs(out_dir, exist_ok=True)
    joblib.dump(artifacts, out_dir / "final_demand_factor_models.joblib")
    print(f"\nTrained model artifacts successfully saved to {out_dir / 'final_demand_factor_models.joblib'}")
    
    # Save CSV benchmark
    summary_df.to_csv(out_dir / "benchmark_results.csv", index=False)
    print(f"Benchmark CSV results saved to {out_dir / 'benchmark_results.csv'}")
