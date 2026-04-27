import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, TrendingUp, Banknote, Clock, Wallet, 
  ChevronDown, ArrowLeft, Activity, Shield
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer
} from "recharts";
import { STOCKS_INFO } from "../constants/stocks";
import { calculateHealthScore } from "../utils/healthScore";

// ── Constants ──────────────────────────────────────────────────────────────
const DEPOSIT_RATE = 0.04;

// ── Formatters ─────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

const pct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-xl p-4 font-sans ring-1 ring-slate-900/5">
      <p className="font-semibold text-slate-900 mb-3">{label}</p>
      <div className="space-y-2">
        {payload.map((p) => (
          <div key={p.name} className="flex justify-between items-center text-sm min-w-[180px] gap-8">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-slate-500 font-medium">{p.name}</span>
            </span>
            <span className="font-bold text-slate-900">{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function ComparePage() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [priceData, setPriceData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Stock Selection
  const [stockA, setStockA] = useState("BBRI");
  const [stockB, setStockB] = useState("BBCA");
  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");
  const [isMenuAOpen, setIsMenuAOpen] = useState(false);
  const [isMenuBOpen, setIsMenuBOpen] = useState(false);
  const menuARef = useRef(null);
  const menuBRef = useRef(null);

  // Common Controls
  const [startYear, setStartYear] = useState(2021);
  const [investStyle, setInvestStyle] = useState("lumpsum");
  const [amount, setAmount] = useState(10000000);
  const [divStrategy, setDivStrategy] = useState("compound");
  const [isYearOpen, setIsYearOpen] = useState(false);

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

  useEffect(() => {
    const handleClick = (e) => {
      if (menuARef.current && !menuARef.current.contains(e.target)) setIsMenuAOpen(false);
      if (menuBRef.current && !menuBRef.current.contains(e.target)) setIsMenuBOpen(false);
      setIsYearOpen(false);
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const availableStocks = useMemo(() => {
    return Object.keys(STOCKS_INFO).map(ticker => {
      const tickerData = data.filter(d => d.Ticker === ticker);
      const health = calculateHealthScore(tickerData);
      return {
        ticker,
        ...STOCKS_INFO[ticker],
        health
      };
    });
  }, [data]);

  const filteredA = useMemo(() => availableStocks.filter(s => s.ticker.toLowerCase().includes(searchA.toLowerCase()) || s.name.toLowerCase().includes(searchA.toLowerCase())), [searchA, availableStocks]);
  const filteredB = useMemo(() => availableStocks.filter(s => s.ticker.toLowerCase().includes(searchB.toLowerCase()) || s.name.toLowerCase().includes(searchB.toLowerCase())), [searchB, availableStocks]);

  const runSim = (ticker) => {
    const tickerDivs = data.filter(d => d.Ticker === ticker && d.Year >= startYear).sort((a, b) => a.Year - b.Year);
    const tickerPrices = priceData.filter(p => p.Ticker === ticker);
    const latestPrice = tickerPrices.length ? tickerPrices[tickerPrices.length - 1].Price : 5000;

    if (!tickerDivs.length) return null;

    let currentShares = 0;
    let totalDiv = 0;
    let totalInvested = 0;
    let leftover = 0;

    const monthlyForTicker = priceData
      .filter(p => p.Ticker === ticker && new Date(p.Date).getFullYear() >= startYear)
      .sort((a, b) => new Date(a.Date) - new Date(b.Date));

    if (investStyle === "lumpsum") {
      const cumPrice0 = tickerDivs[0].Cum_Price;
      currentShares = Math.floor(amount / cumPrice0);
      leftover = amount - currentShares * cumPrice0;
      totalInvested = amount;
    } else {
      const monthlyAmount = amount;
      let dcaLeftover = 0;
      for (const mp of monthlyForTicker) {
        const mpYear = new Date(mp.Date).getFullYear();
        if (mpYear > tickerDivs[tickerDivs.length - 1].Year) break;
        const available = monthlyAmount + dcaLeftover;
        const newShares = Math.floor(available / mp.Price);
        dcaLeftover = available - newShares * mp.Price;
        currentShares += newShares;
        totalInvested += monthlyAmount;
      }
      leftover = dcaLeftover;
    }

    const taxFactor = divStrategy === "passive" ? 0.9 : 1.0;

    const yearly = tickerDivs.map((row) => {
      const divPerShare = (row.Dividend || (row.Cum_Price * 0.05)) * taxFactor;
      const divPayout = Math.round(currentShares * divPerShare);
      totalDiv += divPayout;
      if (divStrategy === "compound") {
        currentShares += Math.floor(divPayout / row.Cum_Price);
      }
      return { year: row.Year, portfolio: Math.round(currentShares * row.Cum_Price + (divStrategy === "passive" ? totalDiv : 0) + leftover) };
    });

    const portfolioValue = currentShares * latestPrice + (divStrategy === "passive" ? totalDiv : 0) + leftover;
    const totalReturn = totalInvested > 0 ? ((portfolioValue - totalInvested) / totalInvested) * 100 : 0;
    
    // Calculate actual historical yields
    const yields = tickerDivs.map(r => r.Dividend / r.Cum_Price);
    const avgYield = yields.length > 0 ? (yields.reduce((s, y) => s + y, 0) / yields.length) * 100 : 0;
    const avgRecovery = tickerDivs.reduce((s, r) => s + (r.Recovery_Days || 0), 0) / tickerDivs.length;

    return { totalReturn, avgYield, avgRecovery, portfolioValue, yearly };
  };

  const simA = useMemo(() => runSim(stockA), [stockA, data, priceData, startYear, investStyle, amount, divStrategy]);
  const simB = useMemo(() => runSim(stockB), [stockB, data, priceData, startYear, investStyle, amount, divStrategy]);

  const chartData = useMemo(() => {
    if (!simA || !simB) return [];
    const years = Array.from(new Set([...simA.yearly.map(d => d.year), ...simB.yearly.map(d => d.year)])).sort();
    return years.map(y => {
      const valA = simA.yearly.find(d => d.year === y)?.portfolio;
      const valB = simB.yearly.find(d => d.year === y)?.portfolio;
      return { year: y, [stockA]: valA, [stockB]: valB };
    });
  }, [simA, simB, stockA, stockB]);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400 tracking-wide font-sans font-medium">Menganalisis duel emiten…</p>
      </div>
    </div>
  );

  return (
    <div className="font-sans bg-slate-50 min-h-screen">
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-12 space-y-3 md:space-y-4">
        
        {/* ── HEADER ── */}
        <div className="flex flex-col gap-6">
          <button onClick={() => navigate('/')} className="group inline-flex items-center gap-2 text-sm font-bold text-indigo-600 transition-colors cursor-pointer w-fit">
            <div className="p-1.5 rounded-full bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            Back to Discovery
          </button>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">Stock <span className="text-indigo-600">Comparison.</span></h1>
              <p className="text-lg text-slate-500 max-w-2xl font-medium">
                Head-to-head analysis of dividend growth & portfolio performance.
              </p>
            </div>
          </div>
        </div>

        {/* ── SELECTORS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StockSelector 
            label="Stock A" 
            ticker={stockA} 
            isOpen={isMenuAOpen} 
            setOpen={setIsMenuAOpen} 
            search={searchA} 
            setSearch={setSearchA} 
            filtered={filteredA} 
            onSelect={setStockA}
            menuRef={menuARef}
            colorClass="bg-indigo-600"
          />
          <StockSelector 
            label="Stock B" 
            ticker={stockB} 
            isOpen={isMenuBOpen} 
            setOpen={setIsMenuBOpen} 
            search={searchB} 
            setSearch={setSearchB} 
            filtered={filteredB} 
            onSelect={setStockB}
            menuRef={menuBRef}
            colorClass="bg-slate-400"
          />
        </div>

        {/* ── SIMULATION CONTROL PANEL ── */}
        <section className="bg-white border border-slate-200/60 rounded-2xl p-4 md:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Activity className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Simulasi Investasi Bersama</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Modal / Setoran</label>
              <div className="relative">
                <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount.toLocaleString("id-ID")}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\./g, "");
                    if (/^\d*$/.test(raw)) setAmount(Number(raw) || 0);
                  }}
                  className="w-full bg-slate-50 border border-slate-200/60 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 hover:border-indigo-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Metode Investasi</label>
              <div className="flex rounded-2xl border border-slate-200/60 overflow-hidden bg-slate-50 p-1">
                {[{ key: "lumpsum", label: "Sekali Beli" }, { key: "dca", label: "Nabung Rutin" }].map((s) => (
                  <button key={s.key} onClick={() => setInvestStyle(s.key)} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${investStyle === s.key ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/40" : "text-slate-500 hover:text-slate-900"}`}>{s.label}</button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Tahun Mulai</label>
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setIsYearOpen(!isYearOpen)} className="w-full flex items-center justify-between bg-slate-50 border border-slate-200/60 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-900 hover:border-indigo-200 transition-all cursor-pointer">
                  {startYear} <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isYearOpen ? "rotate-180" : ""}`} />
                </button>
                {isYearOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden z-50">
                    {[2021, 2022, 2023, 2024, 2025].map(y => (
                      <button key={y} onClick={() => { setStartYear(y); setIsYearOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors cursor-pointer ${startYear === y ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"}`}>{y}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                Strategi Dividen
                {divStrategy === "passive" && <span className="text-[10px] text-rose-500 font-bold normal-case animate-pulse">Potong Pajak 10%</span>}
              </label>
              <div className="flex rounded-2xl border border-slate-200/60 overflow-hidden bg-slate-50 p-1">
                {[{ key: "compound", label: "Putar Kembali" }, { key: "passive", label: "Cairkan" }].map((s) => (
                  <button key={s.key} onClick={() => setDivStrategy(s.key)} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${divStrategy === s.key ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/40" : "text-slate-500 hover:text-slate-900"}`}>{s.label}</button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CHART ── */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Growth Duel</h2>
              <p className="text-sm font-medium text-slate-500">Portfolio growth comparison</p>
            </div>
            <div className="flex items-center gap-6 bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100">
              <LegendDot color="bg-indigo-600" label={stockA} />
              <LegendDot color="bg-slate-400" label={stockB} />
            </div>
          </div>
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}jt`} width={45} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1.5, strokeDasharray: '4 4' }} />
                <Line type="monotone" dataKey={stockA} stroke="#4f46e5" strokeWidth={4} dot={{ r: 5, fill: "#4f46e5", stroke: "#fff", strokeWidth: 2.5 }} activeDot={{ r: 7, fill: "#4f46e5", stroke: "#fff", strokeWidth: 3 }} />
                <Line type="monotone" dataKey={stockB} stroke="#94a3b8" strokeWidth={3} dot={{ r: 4, fill: "#94a3b8", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 6, fill: "#94a3b8", stroke: "#fff", strokeWidth: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── COMPARISON METRICS ── */}
        <section className="bg-white border border-slate-200/60 rounded-3xl overflow-hidden">
          <div className="px-4 md:px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Head-to-Head Stats</h2>
          </div>
          
          {/* Desktop Header */}
          <div className="hidden sm:grid grid-cols-3 bg-slate-50/50 border-b border-slate-100">
            <div className="px-4 md:px-8 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Metric</div>
            <div className="px-4 md:px-8 py-4 text-xs font-bold text-indigo-600 uppercase tracking-widest text-center flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              {stockA}
            </div>
            <div className="px-4 md:px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              {stockB}
            </div>
          </div>
          
          <div className="divide-y divide-slate-100">
            <ComparisonRow icon={TrendingUp} label="Total Return" valA={pct(simA?.totalReturn || 0)} valB={pct(simB?.totalReturn || 0)} winner={simA?.totalReturn > simB?.totalReturn ? 'A' : 'B'} tickerA={stockA} tickerB={stockB} />
            <ComparisonRow icon={Banknote} label="Avg Yield" valA={pct(simA?.avgYield || 0)} valB={pct(simB?.avgYield || 0)} winner={simA?.avgYield > simB?.avgYield ? 'A' : 'B'} tickerA={stockA} tickerB={stockB} />
            <ComparisonRow icon={Clock} label="Avg Recovery" valA={`${Math.round(simA?.avgRecovery || 0)}d`} valB={`${Math.round(simB?.avgRecovery || 0)}d`} winner={simA?.avgRecovery < simB?.avgRecovery ? 'A' : 'B'} tickerA={stockA} tickerB={stockB} />
            <ComparisonRow icon={Wallet} label="Final Portfolio" valA={fmt(simA?.portfolioValue || 0)} valB={fmt(simB?.portfolioValue || 0)} winner={simA?.portfolioValue > simB?.portfolioValue ? 'A' : 'B'} tickerA={stockA} tickerB={stockB} />
          </div>
        </section>

      </main>
    </div>
  );
}

function StockSelector({ label, ticker, isOpen, setOpen, search, setSearch, filtered, onSelect, menuRef, colorClass }) {
  return (
    <div className={`relative ${isOpen ? "z-[100]" : "z-10"}`} ref={menuRef} onClick={(e) => e.stopPropagation()}>
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{label}</label>
        <button 
          onClick={() => setOpen(!isOpen)}
          className="w-full flex items-center justify-between bg-white border border-slate-200/60 rounded-2xl px-5 py-4 text-left hover:border-indigo-300 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div>
              <p className="font-bold text-slate-900 leading-tight mb-1">{ticker}</p>
              <p className="text-xs text-slate-500 line-clamp-1">{STOCKS_INFO[ticker]?.name}</p>
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-[110] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-3 border-b border-slate-50 bg-slate-50/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                autoFocus
                placeholder="Cari emiten..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              />
            </div>
          </div>
          <div className="max-h-[300px] overflow-y-auto py-2">
            {filtered.map(s => {
              const HIcon = s.health?.Icon || Shield;
              return (
                <button key={s.ticker} onClick={() => { onSelect(s.ticker); setOpen(false); }} className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors text-left cursor-pointer">
                  <div className="min-w-0 pr-3">
                    <p className="font-bold text-slate-900 text-sm tracking-tight">{s.ticker}</p>
                    <p className="text-xs text-slate-500 truncate">{s.name}</p>
                  </div>
                  {s.health && (
                    <div className={`shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold ring-1 ${s.health.badgeClass}`}>
                      <HIcon className="w-2.5 h-2.5" />
                      {s.health.label}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ComparisonRow({ icon: Icon, label, valA, valB, winner, tickerA, tickerB }) {
  return (
    <div className="flex flex-col sm:grid sm:grid-cols-3 items-stretch group">
      {/* Metric Title */}
      <div className="px-4 md:px-8 py-2 sm:py-3 flex items-center justify-center sm:justify-start gap-3 bg-slate-50/30 sm:bg-transparent border-b sm:border-0 border-slate-100/50">
        <div className="hidden sm:flex w-8 h-8 rounded-lg bg-white sm:bg-slate-50 border border-slate-100 sm:border-0 items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm font-bold text-slate-900 tracking-tight">{label}</span>
      </div>
      
      {/* Values */}
      <div className="grid grid-cols-2 sm:contents">
        <div className={`px-4 md:px-8 py-2.5 sm:py-3 text-center transition-all ${winner === 'A' ? 'text-emerald-700 bg-emerald-100/60 font-black' : 'text-slate-500 font-bold'} border-r sm:border-0 border-slate-100/50`}>
          <div className="sm:hidden text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">{tickerA}</div>
          <div className="text-base sm:text-sm tracking-tight text-center">{valA}</div>
        </div>
        <div className={`px-4 md:px-8 py-2.5 sm:py-3 text-center transition-all ${winner === 'B' ? 'text-emerald-700 bg-emerald-100/60 font-black' : 'text-slate-500 font-bold'}`}>
          <div className="sm:hidden text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">{tickerB}</div>
          <div className="text-base sm:text-sm tracking-tight text-center">{valB}</div>
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`w-2.5 h-2.5 rounded-full ${color} shadow-sm`} />
      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{label}</span>
    </div>
  );
}
