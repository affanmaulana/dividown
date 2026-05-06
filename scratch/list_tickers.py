
import json
import re

with open('d:/Dokumen/SaaS with AI/dividown/public/data/dividend_recovery.json', 'r') as f:
    div_data = json.load(f)

div_tickers = sorted(list(set(d['Ticker'] for d in div_data)))
print(f"Tickers in div_data ({len(div_tickers)}):")
print(div_tickers)
