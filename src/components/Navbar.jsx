import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { TrendingDown, Search, Shield, X, GitCompare } from "lucide-react";
import { calculateHealthScore } from "../utils/healthScore";

import { STOCKS_INFO } from "../constants/stocks";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState([]);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [mobileSearchActive, setMobileSearchActive] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetch("/data/dividend_recovery.json")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsFocused(false);
        setMobileSearchActive(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setIsFocused(false);
    setMobileSearchActive(false);
    setQuery("");
  }, [location.pathname]);

  const stocks = useMemo(() => {
    if (!data.length) return [];
    
    let result = Object.keys(STOCKS_INFO).map(ticker => {
      const tickerData = data.filter(d => d.Ticker === ticker);
      const health = calculateHealthScore(tickerData);
      return {
        ticker,
        ...STOCKS_INFO[ticker],
        health,
      };
    });

    if (query) {
      const q = query.toLowerCase();
      result = result.filter(s => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
    }
    
    return result;
  }, [data, query]);

  return (
    <nav className="sticky top-0 z-[100] bg-white/80 backdrop-blur-md border-b border-slate-100 h-16">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-full flex items-center justify-between">
        
        {/* LEFT: LOGO */}
        {!mobileSearchActive && (
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <TrendingDown className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-950 font-sans">Dividown</span>
          </Link>
        )}

        {/* RIGHT: COMPARE + SEARCH */}
        <div className={`flex items-center gap-4 md:gap-6 ${mobileSearchActive ? "w-full" : "ml-auto"}`}>
          {!mobileSearchActive && (
            <Link 
              to="/compare" 
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold tracking-tight transition-all duration-300 shrink-0 active:scale-95 group ${
                location.pathname === "/compare" 
                  ? "bg-indigo-600 text-white" 
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-900 border border-slate-100"
              }`}
            >
              <GitCompare className={`w-3.5 h-3.5 ${
                location.pathname === "/compare" ? "text-indigo-200" : "text-slate-400"
              }`} />
              Compare Stocks
            </Link>
          )}

          {/* SEARCH BOX */}
          <div 
            ref={containerRef}
            className={`relative flex items-center transition-all duration-300 ${
              mobileSearchActive ? "w-full" : "w-auto md:w-[320px]"
            }`}
          >
            {/* MOBILE TRIGGER */}
            {!mobileSearchActive && (
              <button 
                onClick={() => {
                  setMobileSearchActive(true);
                  setIsFocused(true);
                  setTimeout(() => inputRef.current?.focus(), 100);
                }}
                className="md:hidden p-2 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                <Search className="w-6 h-6" />
              </button>
            )}

            {/* INPUT FIELD */}
            <div className={`relative w-full ${!mobileSearchActive ? "hidden md:block" : "block"}`}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Cari emiten..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-10 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow font-sans"
              />
              {mobileSearchActive && (
                <button 
                  onClick={() => {
                    setMobileSearchActive(false);
                    setIsFocused(false);
                    setQuery("");
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* DROPDOWN */}
            {isFocused && (
              <div className={`absolute top-full mt-2 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden font-sans animate-in fade-in slide-in-from-top-2 duration-200 ${mobileSearchActive ? "left-0 right-0" : "right-0 w-[320px]"}`}>
                {stocks.length > 0 ? (
                  <div className="max-h-[300px] overflow-y-auto py-2">
                    {stocks.map((stock) => {
                      const HIcon = stock.health?.Icon || Shield;
                      return (
                        <button
                          key={stock.ticker}
                          onClick={() => {
                            setIsFocused(false);
                            setMobileSearchActive(false);
                            setQuery("");
                            navigate(`/stock/${stock.ticker.toLowerCase()}`);
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                        >
                          <div className="min-w-0 pr-3">
                            <p className="font-bold text-slate-900 text-sm tracking-tight">{stock.ticker}</p>
                            <p className="text-xs text-slate-500 truncate">{stock.name}</p>
                          </div>
                          {stock.health && (
                            <div className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ring-1 ${stock.health.badgeClass}`}>
                              <HIcon className="w-3 h-3" />
                              {stock.health.label}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-slate-500 font-sans">Emiten tidak ditemukan.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
