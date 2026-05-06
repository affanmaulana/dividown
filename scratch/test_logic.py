
import json

# Load data
with open('d:/Dokumen/SaaS with AI/dividown/public/data/dividend_recovery.json', 'r') as f:
    data = json.load(f)
with open('d:/Dokumen/SaaS with AI/dividown/public/data/stock_prices.json', 'r') as f:
    price_data = json.load(f)

# Mock STOCKS_INFO
stocks_info = {
    "BBCA": {"name": "Bank Central Asia Tbk.", "sector": "Banks"},
    "ASII": {"name": "Astra International Tbk.", "sector": "Infrastructure"},
    # ... just test these two
}

for ticker in stocks_info:
    ticker_data = [d for d in data if d['Ticker'] == ticker]
    ticker_prices = [p for p in price_data if p['Ticker'] == ticker]
    
    print(f"Ticker: {ticker}")
    print(f"  Data records: {len(ticker_data)}")
    print(f"  Price records: {len(ticker_prices)}")
    
    if len(ticker_data) > 0:
        years = sorted(list(set(d['Year'] for d in ticker_data)))
        print(f"  Years: {years}")
