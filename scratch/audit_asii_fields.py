
import json

with open('d:/Dokumen/SaaS with AI/dividown/public/data/dividend_recovery.json', 'r') as f:
    div_data = json.load(f)

asii_data = [d for d in div_data if d['Ticker'] == 'ASII']
for i, d in enumerate(asii_data):
    print(f"Record {i}: {d}")

with open('d:/Dokumen/SaaS with AI/dividown/public/data/stock_prices.json', 'r') as f:
    price_data = json.load(f)

asii_prices = [p for p in price_data if p['Ticker'] == 'ASII']
print(f"ASII prices sample: {asii_prices[:2]}")
