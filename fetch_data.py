import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json

# ===== KONFIGURASI =====
TICKERS = ["BBRI.JK", "BMRI.JK", "BBNI.JK", "BBCA.JK"]  # bisa ditambah
START_DATE = "2021-01-01"
END_DATE = datetime.now().strftime('%Y-%m-%d')
OUTPUT_FILE = "public/data/dividend_recovery.json"
OUTPUT_PRICES_FILE = "public/data/stock_prices.json"

def get_trading_days_before(date, df_prices, days=2):
    """Cari hari bursa sebelum 'date' sebanyak 'days'"""
    mask = df_prices.index < date
    return df_prices[mask].tail(days).index[0]

def get_next_trading_day(date, df_prices, offset=1):
    """Cari hari bursa setelah 'date'"""
    mask = df_prices.index > date
    if mask.any():
        return df_prices[mask].iloc[offset-1].name  # offset=1 -> hari berikutnya
    return None

def lowest_after_date(df, start_date):
    """Harga terendah (Close) setelah start_date hingga hari ini"""
    mask = df.index >= start_date
    if mask.any():
        return df.loc[mask, "Close"].min()
    return None

def recovery_info(df, ex_date, cum_price):
    """Cari recovery: pertama kali close >= cum_price setelah ex_date.
    Return: (recovery_date, days) atau (None, None) jika masih trap."""
    mask = df.index >= ex_date
    future = df[mask]
    for date, row in future.iterrows():
        if row["Close"] >= cum_price:
            days = (date - ex_date).days
            return date, days
    return None, None

# ===== PROSES UTAMA =====
all_rows = []
monthly_rows = []

for ticker_str in TICKERS:
    print(f"Processing {ticker_str} ...")
    ticker = yf.Ticker(ticker_str)
    
    # 1. Download harga harian
    hist = ticker.history(start=START_DATE, end=END_DATE)
    if hist.empty:
        print(f"  No price data, skip.")
        continue
    hist = hist[["Close"]]  # simpan hanya Close
    
    # 1.5 Download harga bulanan
    hist_monthly = ticker.history(start=START_DATE, end=END_DATE, interval="1mo")
    if not hist_monthly.empty:
        for date, r in hist_monthly.iterrows():
            monthly_rows.append({
                "Ticker": ticker_str.replace(".JK", ""),
                "Date": date.strftime("%Y-%m-%d"),
                "Price": round(r["Close"], 2)
            })
    
    # 2. Download dividen (tanggal ex-date dan amount)
    divs = ticker.dividends
    if divs.empty:
        print(f"  No dividend data, skip.")
        continue
    divs = divs[divs.index >= START_DATE]
    if divs.empty:
        continue

    # Iterasi setiap pembayaran dividen
    for ex_date, div_amount in divs.items():
        # ex_date sudah dalam bentuk Timestamp
        # Cum date: 2 hari bursa sebelum ex_date (aturan umum di Indonesia)
        try:
            cum_date = get_trading_days_before(ex_date, hist, days=2)
        except:
            continue
        
        cum_price = hist.loc[cum_date, "Close"]
        
        # Harga 1 hari setelah ex (hari bursa berikutnya)
        ex_1_day = get_next_trading_day(ex_date, hist, offset=1)
        ex_price_1day = hist.loc[ex_1_day, "Close"] if ex_1_day else None
        
        # Harga terendah setelah ex_date
        lowest_ex = lowest_after_date(hist, ex_date)
        
        # Recovery
        rec_date, rec_days = recovery_info(hist, ex_date, cum_price)
        
        # Tentukan tahun dari cum_date
        year = cum_date.year
        
        # Status recovery
        if rec_days is not None and rec_days <= 365:
            status = "[OK] Sudah"
        elif rec_days is not None and rec_days > 365:
            status = "[WARN] Lambat (>365)"
        else:
            status = "[X] Trap"
        
        # Simpan baris
        row = {
            "Ticker": ticker_str.replace(".JK", ""),
            "Year": year,
            "Cum_Date": cum_date.strftime("%Y-%m-%d"),
            "Cum_Price": round(cum_price, 2),
            "Ex_Price_1day": round(ex_price_1day, 2) if ex_price_1day else None,
            "Lowest_After_Ex": round(lowest_ex, 2) if lowest_ex else None,
            "Recovery_Date": rec_date.strftime("%Y-%m-%d") if rec_date else None,
            "Recovery_Days": rec_days if rec_days else None,
            "Status_Recovery": status
        }
        all_rows.append(row)
        print(f"  {cum_date.strftime('%Y-%m-%d')} | Div Rp {div_amount:.0f} | Recovery: {rec_days if rec_days else 'Belum'} hari")

# ===== SIMPAN JSON =====
with open(OUTPUT_FILE, "w") as f:
    json.dump(all_rows, f, indent=4)

with open(OUTPUT_PRICES_FILE, "w") as f:
    json.dump(monthly_rows, f, indent=4)

print(f"\n[OK] Selesai! Data dividen tersimpan di '{OUTPUT_FILE}' dengan {len(all_rows)} entri.")
print(f"[OK] Selesai! Data harga bulanan tersimpan di '{OUTPUT_PRICES_FILE}' dengan {len(monthly_rows)} entri.")