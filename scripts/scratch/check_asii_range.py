
import json

with open('d:/Dokumen/SaaS with AI/dividown/public/data/stock_prices.json', 'r') as f:
    price_data = json.load(f)

asii_prices = [p for p in price_data if p['Ticker'] == 'ASII']
if asii_prices:
    print(f"ASII prices: {asii_prices[0]['Date']} to {asii_prices[-1]['Date']}")
else:
    print("No ASII prices found")
