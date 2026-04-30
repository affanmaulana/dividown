import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, TrendingDown, ChevronRight, BarChart3, Banknote, Shield, ArrowUpDown, ChevronDown, ChevronUp, X } from "lucide-react";
import { calculateHealthScore } from "./utils/healthScore";

import { STOCKS_INFO, SECTORS } from "./constants/stocks";

export default function LandingPage() {
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("Semua");
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("ticker"); // ticker, health, events, sector
  const [sortOrder, setSortOrder] = useState("asc"); // asc, desc
  const [isSortOpen, setIsSortOpen] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const sortRef = useRef(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Custom click outside for dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchFocused(false);
      }
      if (sortRef.current && !sortRef.current.contains(event.target)) {
        setIsSortOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const SORT_OPTIONS = [
    { key: "ticker", label: "Abjad (Ticker)" },
    { key: "health", label: "Health Score" },
    { key: "yield", label: "Div. Yield" },
    { key: "return", label: "Annual Return" }
  ];

  const [priceData, setPriceData] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch("/data/dividend_recovery.json").then((r) => r.json()),
      fetch("/data/stock_prices.json").then((r) => r.json())
    ])
      .then(([dDiv, dPrice]) => {
        setData(dDiv);
        setPriceData(dPrice);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const stocks = useMemo(() => {
    if (!data.length) return [];
    const tickers = Object.keys(STOCKS_INFO);

    let result = tickers.map(ticker => {
      const tickerData = data.filter(d => d.Ticker === ticker);
      const tickerPrices = priceData.filter(p => p.Ticker === ticker);
      const health = calculateHealthScore(tickerData);

      // Calculate Avg Annual Dividend %
      const years = [...new Set(tickerData.map(d => d.Year))];
      const annualYields = years.map(y => {
        const events = tickerData.filter(d => d.Year === y);
        const totalDiv = events.reduce((s, e) => s + (e.Dividend || 0), 0);
        const avgPrice = events.reduce((s, e) => s + (e.Cum_Price || 0), 0) / events.length;
        return (totalDiv / (avgPrice || 1)) * 100;
      });
      const avgAnnualYield = annualYields.length > 0
        ? annualYields.reduce((s, y) => s + y, 0) / annualYields.length
        : 0;

      // Calculate Average Annual Return (Simplified CAGR)
      let annualReturn = 0;
      if (tickerPrices.length > 0 && tickerData.length > 0) {
        const startPrice = tickerPrices[0].Price;
        const endPrice = tickerPrices[tickerPrices.length - 1].Price;
        const totalDividends = tickerData.reduce((s, d) => s + (d.Dividend || 0), 0);

        const totalReturn = ((endPrice + totalDividends - startPrice) / startPrice);
        const numYears = (new Date(tickerPrices[tickerPrices.length - 1].Date) - new Date(tickerPrices[0].Date)) / (1000 * 60 * 60 * 24 * 365.25);

        annualReturn = (totalReturn / Math.max(0.5, numYears)) * 100;
      }

      return {
        ticker,
        name: STOCKS_INFO[ticker]?.name || ticker,
        sector: STOCKS_INFO[ticker]?.sector || tickerData[0]?.Sector || "Other",
        health,
        avgAnnualYield,
        annualReturn
      };
    });

    if (sectorFilter !== "Semua") {
      result = result.filter(s => s.sector === sectorFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
    }

    // SORTING LOGIC
    result.sort((a, b) => {
      let valA, valB;

      switch (sortBy) {
        case "health":
          valA = a.health?.score || 0;
          valB = b.health?.score || 0;
          break;
        case "yield":
          valA = a.avgAnnualYield;
          valB = b.avgAnnualYield;
          break;
        case "return":
          valA = a.annualReturn;
          valB = b.annualReturn;
          break;
        default:
          valA = a.ticker;
          valB = b.ticker;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, search, sectorFilter, sortBy, sortOrder]);

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
      <section className="py-24 px-4 md:px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-8 ring-1 ring-indigo-500/10">
          Financial Portal
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
          Dividend, kok <span className="text-indigo-600">Down?</span>
        </h1>
        <p className="text-slate-500 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-12">
          Discover hidden dividend traps, analyze recovery patterns, and protect your portfolio with data-driven insights.
        </p>

        {/* DISCOVERY CONTROLS */}
        <div className="flex flex-col items-center gap-6">
          {/* SEARCH BAR */}
          <div className="w-full max-w-2xl md:max-w-3xl relative" ref={searchRef}>
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari emiten dividen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              className="w-full h-14 pl-14 pr-12 bg-white border border-slate-200 rounded-full text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all font-sans"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setIsSearchFocused(false);
                }}
                className="absolute right-5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* LIVE SEARCH POPUP (Mobile Only) */}
            {isSearchFocused && search && (
              <div className="md:hidden absolute top-full left-0 right-0 mt-3 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
                {stocks.length > 0 ? (
                  <div className="max-h-[320px] overflow-y-auto py-2">
                    {stocks.map((stock) => {
                      const HIcon = stock.health?.Icon || Shield;
                      return (
                        <button
                          key={stock.ticker}
                          onClick={() => {
                            setIsSearchFocused(false);
                            setSearch("");
                            navigate(`/stock/${stock.ticker.toLowerCase()}`);
                          }}
                          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left cursor-pointer border-b border-slate-50 last:border-0"
                        >
                          <div className="min-w-0 pr-3">
                            <p className="font-bold text-slate-900 text-base tracking-tight">{stock.ticker}</p>
                            <p className="text-xs text-slate-500 truncate">{stock.name}</p>
                          </div>
                          {stock.health && (
                            <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold ring-1 ${stock.health.badgeClass}`}>
                              <HIcon className="w-3 h-3" />
                              {stock.health.label}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-6 py-10 text-center text-sm text-slate-500 font-sans">
                    Emiten tidak ditemukan.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTOR FILTERS */}
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {SECTORS.map(s => (
              <button
                key={s}
                onClick={() => setSectorFilter(s)}
                className={`px-6 py-2 rounded-full text-sm font-medium border cursor-pointer transition-all duration-300 ${sectorFilter === s
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-none"
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
      <section className="px-4 md:px-6 pb-24 max-w-6xl mx-auto">
        {/* SORT CONTROLS */}
        <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center mb-6 gap-4">
          <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            {stocks.length} Emiten Ditemukan
          </div>

          <div className="flex items-center gap-3">
            {/* Custom Sort Dropdown */}
            <div className="relative" ref={sortRef} onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setIsSortOpen(!isSortOpen)}
                className="flex items-center gap-3 px-5 py-3 bg-white border border-slate-200/60 rounded-xl text-xs font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 pr-2 border-r border-slate-100">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest">Sort:</span>
                </div>
                {SORT_OPTIONS.find(o => o.key === sortBy)?.label}
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isSortOpen ? "rotate-180" : ""}`} />
              </button>

              {isSortOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="py-1">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => {
                          setSortBy(opt.key);
                          setIsSortOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer ${sortBy === opt.key
                          ? "bg-indigo-50 text-indigo-600"
                          : "text-slate-600 hover:bg-slate-50"
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sort Order Toggle */}
            <button
              onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200/60 rounded-xl text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:border-indigo-300 transition-all cursor-pointer group"
            >
              {sortOrder === "asc" ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  ASCENDING
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  DESCENDING
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {stocks.map((stock) => {
            const HIcon = stock.health?.Icon || Shield;
            const healthColor = stock.health?.badgeClass.split(' ').find(c => c.startsWith('text-')) || 'text-slate-500';

            return (
              <Link
                to={`/stock/${stock.ticker.toLowerCase()}`}
                key={stock.ticker}
                className="group bg-white border border-slate-200/80 rounded-2xl p-6 hover:shadow-2xl hover:shadow-slate-200/50 hover:border-indigo-200 transition-all duration-500 flex flex-col"
              >
                <div className="flex justify-between items-start mb-8">
                  <div className="space-y-1.5">
                    <h3 className="text-3xl font-bold tracking-tight text-slate-900">{stock.ticker}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] leading-none">
                      {stock.sector}
                    </p>
                  </div>
                  <div className="text-right">
                    {stock.health && (
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ring-1 ${stock.health.badgeClass}`}>
                        <HIcon className="w-3.5 h-3.5" />
                        {stock.health.label}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-auto grid grid-cols-2 gap-4 pt-6 border-t border-slate-100">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Avg. Annual Return</span>
                    <div className={`text-xl font-black tracking-tight ${stock.annualReturn >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {stock.annualReturn >= 0 ? '+' : ''}{stock.annualReturn.toFixed(1)}%
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Avg. Div Yield</span>
                    <span className="text-xs font-bold text-slate-900">{stock.avgAnnualYield.toFixed(1)}%</span>
                  </div>
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
