import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime
import json
import os
import time

# ===== KONFIGURASI =====
# Pemetaan Ticker -> Sektor (50 High-Quality Dividend Stocks)
TICKER_SECTOR_MAP = {
    # Banks
    "BBCA.JK": "Banks",
    "BBRI.JK": "Banks",
    "BMRI.JK": "Banks",
    "BBNI.JK": "Banks",
    "BBTN.JK": "Banks",
    "BDMN.JK": "Banks",
    "PNBN.JK": "Banks",
    "BJTM.JK": "Banks",
    "BJBR.JK": "Banks",
    
    # Energy
    "ADRO.JK": "Energy",
    "ITMG.JK": "Energy",
    "PTBA.JK": "Energy",
    "HRUM.JK": "Energy",
    "INDY.JK": "Energy",
    "MEDC.JK": "Energy",
    "AKRA.JK": "Energy",
    "MBAP.JK": "Energy",
    "PGAS.JK": "Energy",
    "POWR.JK": "Energy",
    
    # Consumer (Stable & Defensive)
    "UNVR.JK": "Consumer",
    "ICBP.JK": "Consumer",
    "INDF.JK": "Consumer",
    "MYOR.JK": "Consumer",
    "AMRT.JK": "Consumer",
    "HMSP.JK": "Consumer",
    "GGRM.JK": "Consumer",
    "ROTI.JK": "Consumer",
    "KLBF.JK": "Consumer",
    "MIKA.JK": "Consumer",
    "LPPF.JK": "Consumer",
    "MPMX.JK": "Consumer",
    "SMSM.JK": "Consumer",
    
    # Telecommunication
    "TLKM.JK": "Telecommunication",
    "ISAT.JK": "Telecommunication",
    "EXCL.JK": "Telecommunication",
    
    # Basic Materials
    "ANTM.JK": "Basic Materials",
    "INCO.JK": "Basic Materials",
    "TINS.JK": "Basic Materials",
    "SMGR.JK": "Basic Materials",
    "INTP.JK": "Basic Materials",
    
    # Infrastructure & Industrial
    "ASII.JK": "Infrastructure",
    "UNTR.JK": "Infrastructure",
    "JSMR.JK": "Infrastructure",
    "SMDR.JK": "Infrastructure",
    "TMAS.JK": "Infrastructure",
    "HEXA.JK": "Infrastructure",
    
    # Real Estate & Misc
    "PWON.JK": "Real Estate/Misc",
    "CTRA.JK": "Real Estate/Misc",
    "DMAS.JK": "Real Estate/Misc",
}

TICKERS = list(TICKER_SECTOR_MAP.keys())
START_DATE = "2021-01-01"
END_DATE = datetime.now().strftime('%Y-%m-%d')
OUTPUT_FILE = "public/data/dividend_recovery.json"
OUTPUT_PRICES_FILE = "public/data/stock_prices.json"

# Pastikan folder output ada
os.makedirs("public/data", exist_ok=True)

def get_trading_days_before(date, df_prices, days=2):
    """Cari hari bursa sebelum 'date' sebanyak 'days'"""
    mask = df_prices.index < date
    prev_days = df_prices[mask].tail(days)
    if len(prev_days) < days:
        raise ValueError("Not enough historical data before date")
    return prev_days.index[0]

def get_next_trading_day(date, df_prices, offset=1):
    """Cari hari bursa setelah 'date'"""
    mask = df_prices.index > date
    if mask.any():
        future_days = df_prices[mask]
        if len(future_days) >= offset:
            return future_days.iloc[offset-1].name
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

print(f"Starting production-ready data collection for {len(TICKERS)} tickers...")

for i, ticker_str in enumerate(TICKERS, 1):
    try:
        print(f"[{i}/{len(TICKERS)}] Processing {ticker_str} ...")
        ticker_obj = yf.Ticker(ticker_str)
        sector = TICKER_SECTOR_MAP.get(ticker_str, "Other")
        clean_ticker = ticker_str.replace(".JK", "")
        
        # 1. Download harga harian
        hist = ticker_obj.history(start=START_DATE, end=END_DATE)
        if hist.empty:
            print(f"  [SKIP] No price data found for {ticker_str}")
            continue
        hist = hist[["Close"]]
        
        # 2. Download harga bulanan
        hist_monthly = ticker_obj.history(start=START_DATE, end=END_DATE, interval="1mo")
        if not hist_monthly.empty:
            for date, r in hist_monthly.iterrows():
                monthly_rows.append({
                    "Ticker": clean_ticker,
                    "Date": date.strftime("%Y-%m-%d"),
                    "Price": round(r["Close"], 2)
                })
        
        # 3. Download dividen
        divs = ticker_obj.dividends
        if divs.empty:
            print(f"  [INFO] No dividend data found for {ticker_str}")
            # Skip to next to ensure we don't have empty dividend entries
            time.sleep(1)
            continue
            
        divs = divs[divs.index >= START_DATE]
        if divs.empty:
            print(f"  [INFO] No dividends found since {START_DATE}")
            time.sleep(1)
            continue

        # Iterasi setiap pembayaran dividen
        for ex_date, div_amount in divs.items():
            try:
                # Cum date: 2 hari bursa sebelum ex_date
                cum_date = get_trading_days_before(ex_date, hist, days=2)
                cum_price = hist.loc[cum_date, "Close"]
                
                # Harga 1 hari setelah ex
                ex_1_day = get_next_trading_day(ex_date, hist, offset=1)
                ex_price_1day = hist.loc[ex_1_day, "Close"] if ex_1_day else None
                
                # Harga terendah setelah ex_date
                lowest_ex = lowest_after_date(hist, ex_date)
                
                # Recovery
                rec_date, rec_days = recovery_info(hist, ex_date, cum_price)
                
                # Tentukan tahun dari cum_date
                year = cum_date.year
                
                # Status recovery (Rule update 2026-04-27)
                today = pd.Timestamp('2026-04-27')
                # Ensure ex_date is timezone-naive for comparison if needed, or keep both naive
                ex_date_naive = ex_date.replace(tzinfo=None) if ex_date.tzinfo else ex_date
                
                if rec_days is not None:
                    status = "Pulih"
                else:
                    days_since_ex = (today - ex_date_naive).days
                    if days_since_ex < 60:
                        status = "Berproses"
                    else:
                        status = "Trap"
                
                # Simpan baris dengan properti Sector
                row = {
                    "Ticker": clean_ticker,
                    "Sector": sector,
                    "Year": year,
                    "Dividend": round(div_amount, 2),
                    "Cum_Date": cum_date.strftime("%Y-%m-%d"),
                    "Cum_Price": round(cum_price, 2),
                    "Ex_Price_1day": round(ex_price_1day, 2) if ex_price_1day else None,
                    "Lowest_After_Ex": round(lowest_ex, 2) if lowest_ex else None,
                    "Recovery_Date": rec_date.strftime("%Y-%m-%d") if rec_date else None,
                    "Recovery_Days": rec_days if rec_days else None,
                    "Status_Recovery": status
                }
                all_rows.append(row)
            except Exception as e:
                # Silently skip individual dividend errors but log ticker progress
                continue

        # Avoid rate limiting
        time.sleep(1)

    except Exception as e:
        print(f"  [CRITICAL ERROR] Failed to process {ticker_str}: {e}")
        continue

def atomic_save_json(data, filename):
    """Menyimpan data ke JSON dengan sistem Atomic Replace agar tidak korup saat proses tulis."""
    temp_filename = filename + ".tmp"
    try:
        with open(temp_filename, "w") as f:
            json.dump(data, f, indent=4)
        # os.replace memindahkan temp ke target secara atomik (menimpa jika sudah ada)
        os.replace(temp_filename, filename)
    except Exception as e:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        raise e

# ===== SIMPAN JSON =====
# Safety check: Only write if at least 1 ticker was processed successfully
unique_tickers = set([r['Ticker'] for r in all_rows])

if len(all_rows) > 0:
    atomic_save_json(all_rows, OUTPUT_FILE)
    print(f"[SUCCESS] Wrote {len(all_rows)} dividend events to {OUTPUT_FILE}")
else:
    print("[SKIPPED] No dividend data found. File NOT updated to protect existing data.")

if len(monthly_rows) > 0:
    atomic_save_json(monthly_rows, OUTPUT_PRICES_FILE)
    print(f"[SUCCESS] Wrote {len(monthly_rows)} price points to {OUTPUT_PRICES_FILE}")
else:
    print("[SKIPPED] No price data found. File NOT updated to protect existing data.")

print(f"\n" + "="*50)
print(f"[SUMMARY] Total unique tickers processed: {len(unique_tickers)}")
print(f"[SUMMARY] Total dividend events: {len(all_rows)}")
print(f"[SUMMARY] Total monthly price points: {len(monthly_rows)}")

# Save status
STATUS_FILE = "public/data/status.json"
status_data = {
    "last_updated": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
    "total_tickers": len(unique_tickers),
    "total_events": len(all_rows)
}
atomic_save_json(status_data, STATUS_FILE)
print(f"[SUCCESS] Status updated at {status_data['last_updated']}")
print("="*50)