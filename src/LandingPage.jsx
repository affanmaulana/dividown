import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, TrendingDown, ChevronRight, BarChart3, Banknote } from "lucide-react";
import { calculateHealthScore } from "./utils/healthScore";

const SECTORS = ["Semua", "Banks", "Commodities", "Cyclical", "Consumer", "Telco"];

const STOCKS_INFO = {
  BBCA: { name: "Bank Central Asia Tbk.", sector: "Banks" },
  BBRI: { name: "Bank Rakyat Indonesia Tbk.", sector: "Banks" },
  BMRI: { name: "Bank Mandiri Tbk.", sector: "Banks" },
  BBNI: { name: "Bank Negara Indonesia Tbk.", sector: "Banks" },
  ADRO: { name: "Adaro Energy Indonesia Tbk.", sector: "Commodities" },
  ITMG: { name: "Indo Tambangraya Megah Tbk.", sector: "Commodities" },
  PTBA: { name: "Bukit Asam Tbk.", sector: "Commodities" },
  HRUM: { name: "Harum Energy Tbk.", sector: "Commodities" },
  ANTM: { name: "Aneka Tambang Tbk.", sector: "Commodities" },
  ASII: { name: "Astra International Tbk.", sector: "Cyclical" },
  UNTR: { name: "United Tractors Tbk.", sector: "Cyclical" },
  TLKM: { name: "Telkom Indonesia Tbk.", sector: "Telco" },
  ISAT: { name: "Indosat Ooredoo Hutchison Tbk.", sector: "Telco" },
  UNVR: { name: "Unilever Indonesia Tbk.", sector: "Consumer" },
  ICBP: { name: "Indofood CBP Sukses Makmur Tbk.", sector: "Consumer" },
  INDF: { name: "Indofood Sukses Makmur Tbk.", sector: "Consumer" },
  HMSP: { name: "HM Sampoerna Tbk.", sector: "Consumer" },
  GGRM: { name: "Gudang Garam Tbk.", sector: "Consumer" },
};

export default function LandingPage() {
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("Semua");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/dividend_recovery.json")
      .then((r) => r.json())
      .then((dDiv) => {
        setData(dDiv);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const stocks = useMemo(() => {
    if (!data.length) return [];
    const tickers = Object.keys(STOCKS_INFO);
    
    let result = tickers.map(ticker => {
      const tickerData = data.filter(d => d.Ticker === ticker);
      const health = calculateHealthScore(tickerData);
      const dataInfo = tickerData.length > 0 ? tickerData[0] : null;
      
      return {
        ticker,
        name: STOCKS_INFO[ticker]?.name || ticker,
        sector: STOCKS_INFO[ticker]?.sector || dataInfo?.Sector || "Other",
        health,
        eventsCount: tickerData.length
      };
    });

    if (sectorFilter !== "Semua") {
      result = result.filter(s => s.sector === sectorFilter);
    }
    
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
    }
    
    return result;
  }, [data, search, sectorFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 tracking-wide">Memuat portal…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans">
      {/* HEADER REMOVED - NOW IN LAYOUT */}

      {/* HERO */}
      <section className="py-24 px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-8 ring-1 ring-indigo-500/10">
          Financial Portal
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
          Invest With <span className="text-indigo-600">Confidence.</span>
        </h1>
        <p className="text-slate-500 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-12">
          Discover hidden dividend traps, analyze recovery patterns, and protect your portfolio with data-driven insights.
        </p>

        {/* DISCOVERY CONTROLS */}
        <div className="flex flex-col items-center gap-6">
          {/* SEARCH BAR */}
          <div className="w-full max-w-2xl md:max-w-3xl relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari emiten dividen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-14 pl-14 pr-6 bg-white border border-slate-200 rounded-full shadow-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all font-sans"
            />
          </div>

          {/* SECTOR FILTERS */}
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {SECTORS.map(s => (
              <button
                key={s}
                onClick={() => setSectorFilter(s)}
                className={`px-6 py-2 rounded-full text-sm font-medium border cursor-pointer transition-all duration-300 ${
                  sectorFilter === s 
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100" 
                    : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* STOCK GRID */}
      <section className="px-6 pb-24 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stocks.map((stock) => {
            const HIcon = stock.health?.Icon || Shield;
            return (
              <Link 
                to={`/stock/${stock.ticker.toLowerCase()}`} 
                key={stock.ticker}
                className="group bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-2xl hover:shadow-slate-200/50 hover:border-indigo-200 transition-all duration-300 flex flex-col"
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight mb-1">{stock.ticker}</h3>
                    <p className="text-sm text-slate-500 line-clamp-1">{stock.name}</p>
                  </div>
                  {stock.health && (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ring-1 ${stock.health.badgeClass}`}>
                      <HIcon className="w-3.5 h-3.5" />
                      {stock.health.label}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-8">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                    <BarChart3 className="w-3.5 h-3.5" /> {stock.sector}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                    <Banknote className="w-3.5 h-3.5" /> {stock.eventsCount} Events
                  </span>
                </div>

                <div className="mt-auto flex items-center text-sm font-semibold text-indigo-600 group-hover:text-indigo-700 transition-colors">
                  Analyze Stock 
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
          {stocks.length === 0 && (
             <div className="col-span-full py-12 text-center text-slate-500">
               No stocks found matching your criteria.
             </div>
          )}
        </div>
      </section>
      
      {/* FOOTER */}
      <footer className="border-t border-slate-100 py-12 text-center">
        <p className="text-slate-400 text-sm">© 2026 Dividown Portal. Data historis, bukan rekomendasi investasi.</p>
      </footer>
    </div>
  );
}
