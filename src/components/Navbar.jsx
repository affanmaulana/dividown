import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { TrendingDown, ChevronDown, Search } from "lucide-react";

const TICKERS = ["BBCA", "BBRI", "BMRI", "BBNI"];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // Close dropdown on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  return (
    <nav className="sticky top-0 z-[100] bg-white/80 backdrop-blur-md border-b border-slate-100 h-16">
      <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
        {/* LOGO */}
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <TrendingDown className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-950 font-sans">Dividown</span>
        </Link>

        {/* NAVIGATION & QUICK SWITCH */}
        <div className="flex items-center gap-4 md:gap-8">
          <Link 
            to="/" 
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${
              location.pathname === "/" ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Search/Home</span>
          </Link>

          {/* QUICK SWITCH DROPDOWN */}
          <div className="relative">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all"
            >
              Quick Switch
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
              <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Select Ticker
                </div>
                {TICKERS.map((t) => (
                  <button
                    key={t}
                    onClick={() => navigate(`/stock/${t.toLowerCase()}`)}
                    className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
