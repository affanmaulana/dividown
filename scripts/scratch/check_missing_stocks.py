
import json
import os

with open('d:/Dokumen/SaaS with AI/dividown/public/data/dividend_recovery.json', 'r') as f:
    div_data = json.load(f)

with open('d:/Dokumen/SaaS with AI/dividown/public/data/stock_prices.json', 'r') as f:
    price_data = json.load(f)

# Extract stocks info from the JS file manually or just list them here if I can't easily parse JS
# I'll just check for ASII first to confirm the script works, then maybe I can read the JS file.

div_tickers = set(d['Ticker'] for d in div_data)
price_tickers = set(p['Ticker'] for p in price_data)

print(f"Tickers in div data: {len(div_tickers)}")
print(f"Tickers in price data: {len(price_tickers)}")

# Let's read STOCKS_INFO from src/constants/stocks.js
with open('d:/Dokumen/SaaS with AI/dividown/src/constants/stocks.js', 'r') as f:
    content = f.read()
    # Very simple extraction
    import re
    expected_tickers = re.findall(r'([A-Z]{4}): {', content)

print(f"Expected tickers in STOCKS_INFO: {len(expected_tickers)}")

missing_div = [t for t in expected_tickers if t not in div_tickers]
missing_price = [t for t in expected_tickers if t not in price_tickers]

print(f"Missing in div data: {missing_div}")
print(f"Missing in price data: {missing_price}")
