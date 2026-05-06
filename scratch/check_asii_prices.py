
import json

with open('d:/Dokumen/SaaS with AI/dividown/public/data/stock_prices.json', 'r') as f:
    price_data = json.load(f)

asii_prices = [p for p in price_data if p['Ticker'] == 'ASII']
print(f"ASII prices found: {len(asii_prices)}")
