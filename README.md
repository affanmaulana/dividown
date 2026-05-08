# Dividown

Dividown adalah platform analisis saham untuk mendeteksi **Dividend Trap** dan menghitung **Total Return** (termasuk dividen) secara historis untuk saham-saham di IHSG.

## Fitur Utama
- **Deteksi Dividend Trap**: Menganalisis seberapa cepat harga saham pulih setelah *Ex-Date*.
- **Simulasi Investasi**: Kalkulator investasi (Lumpsum & DCA) dengan opsi strategi dividen (*Compound* atau *Passive*).
- **Safety Score**: Penilaian risiko saham berdasarkan data historis pemulihan dan volatilitas harga.
- **Head-to-Head Comparison**: Bandingkan performa dua saham secara langsung.

## Struktur Proyek
- `src/pages/`: Halaman utama aplikasi (Landing, Detail, Compare).
- `src/components/`: Komponen UI yang dapat digunakan kembali.
- `src/constants/`: Data statis dan konfigurasi saham.
- `src/utils/`: Logika perhitungan (misal: Health Score).
- `public/data/`: Data JSON hasil scraping (Dividend & Price).
- `scripts/`: Skrip pemeliharaan data dan scraping.
  - `fetch_data.py`: Skrip utama untuk mengambil data terbaru.
  - `scratch/`: Koleksi skrip pengujian dan audit.

## Teknologi
- **Frontend**: React + Vite + Tailwind CSS
- **Visualisasi**: Recharts
- **Icons**: Lucide React
- **Data Scraping**: Python

## Menjalankan Proyek
1. Instalasi dependensi: `npm install`
2. Jalankan mode pengembangan: `npm run dev`
3. Bangun untuk produksi: `npm run build`
