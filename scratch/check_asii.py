
import json

with open('d:/Dokumen/SaaS with AI/dividown/public/data/dividend_recovery.json', 'r') as f:
    div_data = json.load(f)

asii_data = [d for d in div_data if d['Ticker'] == 'ASII']
print(f"ASII records found: {len(asii_data)}")
if asii_data:
    print(asii_data[0])
