
import json
import re

with open('d:/Dokumen/SaaS with AI/dividown/public/data/dividend_recovery.json', 'r') as f:
    div_data = json.load(f)

with open('d:/Dokumen/SaaS with AI/dividown/public/data/stock_prices.json', 'r') as f:
    price_data = json.load(f)

with open('d:/Dokumen/SaaS with AI/dividown/src/constants/stocks.js', 'r') as f:
    content = f.read()
    expected_tickers = set(re.findall(r'([A-Z]{4}): {', content))

div_tickers = set(d['Ticker'] for d in div_data)
price_tickers = set(p['Ticker'] for p in price_data)

broken = []
for t in expected_tickers:
    if t not in div_tickers or t not in price_tickers:
        broken.append(t)
    else:
        # Check if they have at least one record
        d_count = sum(1 for d in div_data if d['Ticker'] == t)
        p_count = sum(1 for p in price_data if p['Ticker'] == t)
        if d_count == 0 or p_count == 0:
            broken.append(t)

print(f"Broken tickers (0 data): {broken}")
