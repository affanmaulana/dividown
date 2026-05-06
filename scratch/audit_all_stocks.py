
import json
import re

with open('d:/Dokumen/SaaS with AI/dividown/public/data/dividend_recovery.json', 'r') as f:
    div_data = json.load(f)

with open('d:/Dokumen/SaaS with AI/dividown/public/data/stock_prices.json', 'r') as f:
    price_data = json.load(f)

with open('d:/Dokumen/SaaS with AI/dividown/src/constants/stocks.js', 'r') as f:
    content = f.read()
    expected_tickers = set(re.findall(r'([A-Z]{4}): {', content))

for t in sorted(list(expected_tickers)):
    d_count = sum(1 for d in div_data if d['Ticker'] == t)
    p_count = sum(1 for p in price_data if p['Ticker'] == t)
    if d_count == 0 or p_count == 0:
        print(f"CRITICAL: {t} has {d_count} div events and {p_count} price points")
    # else:
    #     print(f"OK: {t}")
