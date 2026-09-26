"""
Data Preparation Module for PIMS Pharmaceutical Offline Forecasting.

Audit & Fixes:
1. Future Leakage Elimination: Jan 2017 outage is imputed strictly using past historical
   Januaries (2014-01, 2015-01, 2016-01). No future data (e.g. 2018) is used.
2. Partial-Month Handling: October 2019 was truncated mid-month in data collection.
   It is excluded from completed monthly dataset to ensure November 2019 predictions
   use only completed data through September 2019 without data fabrication.
"""

import pandas as pd
import numpy as np
from pathlib import Path

ATC_CATEGORIES = ["M01AB", "M01AE", "N02BA", "N02BE", "N05B", "N05C", "R03", "R06"]

CATEGORY_DESCRIPTIONS = {
    "M01AB": "Anti-inflammatory and antirheumatic products (Acetic acid derivatives, e.g. Diclofenac)",
    "M01AE": "Anti-inflammatory and antirheumatic products (Propionic acid derivatives, e.g. Ibuprofen)",
    "N02BA": "Analgesics / Antipyretics (Salicylic acid and derivatives, e.g. Aspirin)",
    "N02BE": "Analgesics / Antipyretics (Anilides, e.g. Paracetamol)",
    "N05B": "Psycholeptics / Anxiolytics (e.g. Diazepam/Alprazolam)",
    "N05C": "Psycholeptics / Hypnotics and sedatives",
    "R03": "Drugs for obstructive airway diseases (e.g. Salbutamol / Inhalers)",
    "R06": "Antihistamines for systemic use (Allergy medication, e.g. Cetirizine)"
}


def load_raw_dataset(csv_path: str = None) -> pd.DataFrame:
    """Load raw dataset from CSV file."""
    if csv_path is None:
        csv_path = Path(__file__).resolve().parent.parent / "app" / "sales_monthly.csv"
    
    df = pd.read_csv(csv_path)
    df["datum"] = pd.to_datetime(df["datum"])
    df = df.sort_values("datum").reset_index(drop=True)
    return df


def clean_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """
    Cleans raw observations with zero future-data leakage:
    1. 2017-01 outage is imputed using strictly preceding historical Januaries (2014, 2015, 2016).
       Zero future data (e.g., 2018) is referenced.
    2. Partial month 2019-10 (truncated collection) is excluded from the completed monthly series.
       The completed dataset contains 69 verified full months (2014-01 to 2019-09).
    """
    clean_df = df.copy()
    
    # 1. Handle 2017-01 outage using ONLY strictly past historical Januaries (2014, 2015, 2016)
    outage_mask = (clean_df["datum"].dt.year == 2017) & (clean_df["datum"].dt.month == 1)
    if outage_mask.any():
        idx_2017_01 = clean_df[outage_mask].index[0]
        # Past Januaries only (strictly before 2017)
        past_jan_mask = (clean_df["datum"].dt.month == 1) & (clean_df["datum"].dt.year < 2017)
        past_jan_indices = clean_df[past_jan_mask].index.tolist()
        
        for col in ATC_CATEGORIES:
            past_jan_vals = clean_df.loc[past_jan_indices, col].values
            imputed_val = float(np.mean(past_jan_vals)) if len(past_jan_vals) > 0 else 0.0
            clean_df.loc[idx_2017_01, col] = imputed_val

    # 2. Exclude incomplete / partial month (2019-10) from completed dataset
    partial_oct_mask = (clean_df["datum"].dt.year == 2019) & (clean_df["datum"].dt.month == 10)
    clean_df = clean_df[~partial_oct_mask].reset_index(drop=True)

    # 3. Add calendar features
    clean_df["month"] = clean_df["datum"].dt.month
    clean_df["year"] = clean_df["datum"].dt.year
    clean_df["month_idx"] = np.arange(len(clean_df))
    return clean_df


if __name__ == "__main__":
    raw = load_raw_dataset()
    cleaned = clean_dataset(raw)
    print(f"Loaded raw: {len(raw)} rows. Cleaned completed months: {len(cleaned)} rows ({cleaned['datum'].min().date()} to {cleaned['datum'].max().date()})")
    print("\nCleaned summary statistics (69 completed months):")
    print(cleaned[ATC_CATEGORIES].describe().round(2))
