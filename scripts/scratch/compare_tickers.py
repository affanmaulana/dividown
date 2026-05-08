
import json
import re

with open('d:/Dokumen/SaaS with AI/dividown/public/data/dividend_recovery.json', 'r') as f:
    div_data = json.load(f)

with open('d:/Dokumen/SaaS with AI/dividown/src/constants/stocks.js', 'r') as f:
    content = f.read()
    expected_tickers = set(re.findall(r'([A-Z]{4}): {', content))

div_tickers = set(d['Ticker'] for d in div_data)

print(f"Expected but missing in data: {expected_tickers - div_tickers}")
print(f"In data but not expected: {div_tickers - expected_tickers}")
