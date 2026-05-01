import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, Banknote, Clock, Wallet, BarChart3,
  Activity, CheckCircle2, XCircle, ChevronDown, AlertTriangle,
  Calendar, ChevronLeft, ChevronRight, Share2, Check
} from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
import { calculateHealthScore } from "./utils/healthScore";
import { STOCKS_INFO } from "./constants/stocks";

// ── Constants ──────────────────────────────────────────────────────────────
const DEPOSIT_RATE = 0.04;
const LATEST_PRICES = { BBRI: 4410, BMRI: 5600, BBCA: 9800, BBNI: 4850 };

// ── Formatters ─────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

const pct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

// ── Custom Tooltip ─────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const dataPoint = payload[0]?.payload || {};
  const dividendType = dataPoint.dividendType || "";
  const displayYear = dataPoint.year || "";
  const typeClass = dividendType === "Final Dividend" ? "text-emerald-700" : "text-indigo-700";

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-xl p-4 font-sans ring-1 ring-slate-900/5">
      <p className="font-semibold text-slate-900 mb-1">{displayYear}</p>
      {dividendType && (
        <p className={`text-[10px] uppercase tracking-wider font-bold ${typeClass} mb-3`}>{dividendType}</p>
      )}
      <div className="space-y-2">
        {payload.map((p) => (
          <div key={p.name} className="flex justify-between items-center text-sm min-w-[160px] gap-4">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-slate-500 font-medium">{p.name}</span>
            </span>
            <span className="font-bold text-slate-900">{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const CustomPriceTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const dataPoint = payload[0]?.payload || {};
  const displayDate = dataPoint.displayDate || label;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-xl p-4 font-sans ring-1 ring-slate-900/5">
      <p className="font-semibold text-slate-900 mb-3">{displayDate}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between items-center text-sm gap-8">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-500 font-medium">{p.name}</span>
          </span>
          <span className="font-bold text-slate-900">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ── App ────────────────────────────────────────────────────────────────────
export default function StockDetail() {
  const [data, setData] = useState([]);
  const [priceData, setPriceData] = useState([]);
  const { ticker: urlTicker } = useParams();
  const navigate = useNavigate();
  const ticker = urlTicker ? urlTicker.toUpperCase() : "BBRI";

  const [searchParams, setSearchParams] = useSearchParams();

  // Initial values from URL or defaults
  const initialAmount = Number(searchParams.get("amount")) || 10000000;
  const initialYear = Number(searchParams.get("start_year")) || 2021;
  const initialMonth = Number(searchParams.get("start_month")) || 1;
  const initialStyle = searchParams.get("style") || "lumpsum";
  const initialStrategy = searchParams.get("strategy") || "compound";

  // New simulation inputs
  const [startYear, setStartYear] = useState(initialYear);
  const [startMonth, setStartMonth] = useState(initialMonth);
  const [investStyle, setInvestStyle] = useState(initialStyle);
  const [amount, setAmount] = useState(initialAmount);
  const [divStrategy, setDivStrategy] = useState(initialStrategy);
  const [loading, setLoading] = useState(true);
  const [isYearOpen, setIsYearOpen] = useState(false);
  const [activeMobileTooltip, setActiveMobileTooltip] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set("amount", amount.toString());
    params.set("start_year", startYear.toString());
    params.set("start_month", startMonth.toString());
    params.set("style", investStyle);
    params.set("strategy", divStrategy);

    setSearchParams(params, { replace: true });
  }, [amount, startYear, startMonth, investStyle, divStrategy, setSearchParams]);

  // Responsive listener
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Custom click outside for dropdowns & mobile tooltips
  useEffect(() => {
    const handleClick = () => {
      setIsYearOpen(false);
      setActiveMobileTooltip(null);
    };
    if (isYearOpen || activeMobileTooltip) {
      window.addEventListener("click", handleClick);
    }
    return () => window.removeEventListener("click", handleClick);
  }, [isYearOpen, activeMobileTooltip]);

  useEffect(() => {
    Promise.all([
      fetch("/data/dividend_recovery.json").then((r) => r.json()),
      fetch("/data/stock_prices.json").then((r) => r.json())
    ])
      .then(([dDiv, dPrice]) => {
        const enriched = dDiv.map((row) => {
          const date = new Date(row.Cum_Date);
          const month = date.getMonth() + 1;
          const dividendType = (month === 3 || month === 4) ? "Final Dividend" : (month === 11 || month === 12) ? "Interim Dividend" : "";
          return { ...row, dividendType };
        });
        setData(enriched);
        setPriceData(dPrice);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);



  const filtered = useMemo(
    () => data
      .filter((d) => {
        const dDate = new Date(d.Cum_Date);
        const dYear = dDate.getFullYear();
        const dMonth = dDate.getMonth() + 1;
        const isAfterStart = dYear > startYear || (dYear === startYear && dMonth >= startMonth);
        return d.Ticker === ticker && isAfterStart;
      })
      .sort((a, b) => new Date(a.Cum_Date) - new Date(b.Cum_Date)),
    [data, ticker, startYear, startMonth]
  );

  const filteredPrices = useMemo(
    () => priceData
      .filter((p) => {
        const pDate = new Date(p.Date);
        const pYear = pDate.getFullYear();
        const pMonth = pDate.getMonth() + 1;
        const isAfterStart = pYear > startYear || (pYear === startYear && pMonth >= startMonth);
        return p.Ticker === ticker && isAfterStart;
      })
      .map((p) => ({
        ...p,
        displayDate: new Date(p.Date).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
      })),
    [priceData, ticker, startYear, startMonth]
  );

  const latestPrice = useMemo(() => {
    const prices = priceData.filter(p => p.Ticker === ticker);
    if (prices.length) return prices[prices.length - 1].Price;
    return LATEST_PRICES[ticker] ?? 5000;
  }, [priceData, ticker]);

  // ── Calculation Engine (Lumpsum + DCA) ────────────────────────────────────
  const engine = useMemo(() => {
    let currentShares = 0;
    let totalDiv = 0;
    let totalInvested = 0;
    let leftover = 0;

    // Get monthly prices for this ticker filtered by start date
    const monthlyForTicker = priceData
      .filter(p => {
        const pDate = new Date(p.Date);
        const pYear = pDate.getFullYear();
        const pMonth = pDate.getMonth() + 1;
        const isAfterStart = pYear > startYear || (pYear === startYear && pMonth >= startMonth);
        return p.Ticker === ticker && isAfterStart;
      })
      .sort((a, b) => new Date(a.Date) - new Date(b.Date));

    if (monthlyForTicker.length === 0) return null;

    if (investStyle === "lumpsum") {
      // Buy all shares at the first available monthly price (the start date price)
      const startPrice = monthlyForTicker[0]?.Price;
      if (!startPrice) return null;
      currentShares = Math.floor(amount / startPrice);
      leftover = amount - currentShares * startPrice;
      totalInvested = amount;
    } else {
      // DCA: buy shares each month using monthly prices
      const monthlyAmount = amount;
      let dcaLeftover = 0;
      for (const mp of monthlyForTicker) {
        const available = monthlyAmount + dcaLeftover;
        const newShares = Math.floor(available / mp.Price);
        dcaLeftover = available - newShares * mp.Price;
        currentShares += newShares;
        totalInvested += monthlyAmount;
      }
      leftover = dcaLeftover;
    }

    const today = new Date();
    const yearly = filtered.map((row) => {
      // 10% Tax applies if not reinvested (Passive strategy)
      const taxFactor = divStrategy === "passive" ? 0.9 : 1.0;
      const divPerShare = (row.Dividend || (row.Cum_Price * 0.05)) * taxFactor;
      const divPayout = Math.round(currentShares * divPerShare);

      totalDiv += divPayout;
      if (divStrategy === "compound") {
        currentShares += Math.floor(divPayout / row.Cum_Price);
      }

      // New Status Logic
      const cumDate = new Date(row.Cum_Date);
      const ageInDays = Math.floor((today - cumDate) / (1000 * 60 * 60 * 24));
      const hasRecoveredOnce = row.Status_Recovery === "Pulih";
      const isDroppedNow = latestPrice < (row.Cum_Price * 0.95);

      let newStatus = "";
      if (hasRecoveredOnce) {
        newStatus = isDroppedNow ? "DROP AGAIN" : "RECOVERED";
      } else {
        newStatus = ageInDays > 365 ? "DIVIDEND TRAP" : "BERPROSES";
      }

      const recoveryDisplay = hasRecoveredOnce
        ? `${row.Recovery_Days || 0}d`
        : `${ageInDays}d++`;

      return {
        ...row,
        divPerShare,
        divPayout,
        sharesAfter: currentShares,
        totalDivSoFar: totalDiv,
        newStatus,
        recoveryDisplay,
        hasRecoveredOnce
      };
    });

    let chartData = yearly.map((r, i) => ({
      id: i,
      year: r.Year,
      dividendType: r.dividendType,
      Portfolio: Math.round(
        r.sharesAfter * r.Cum_Price + (divStrategy === "passive" ? r.totalDivSoFar : 0) + leftover
      ),
      Deposito: Math.round(totalInvested * Math.pow(1 + DEPOSIT_RATE, i + 1)),
    }));

    // FALLBACK: If no dividends happened, show start vs end price
    if (chartData.length === 0) {
      chartData = [
        {
          id: 0,
          year: startYear,
          Portfolio: totalInvested,
          Deposito: totalInvested
        },
        {
          id: 1,
          year: new Date().getFullYear(),
          Portfolio: Math.round(currentShares * latestPrice + leftover),
          Deposito: Math.round(totalInvested * Math.pow(1 + DEPOSIT_RATE, (new Date().getFullYear() - startYear) || 1))
        }
      ];
    }

    // Source of Truth: Derived from chartData to avoid visual discrepancy
    const lastPoint = chartData[chartData.length - 1];
    const portfolioValue = lastPoint ? lastPoint.Portfolio : 0;
    const depositValue = lastPoint ? lastPoint.Deposito : totalInvested;
    const netProfit = portfolioValue - totalInvested;
    const totalReturn = totalInvested > 0 ? ((portfolioValue - totalInvested) / totalInvested) * 100 : 0;

    const avgRecovery = filtered.length > 0 ? filtered.reduce((s, r) => s + (r.Recovery_Days || 0), 0) / filtered.length : 0;
    const notRecovered = filtered.filter((r) => r.Status_Recovery === "Trap").length;
    const years = filtered.length;
    const isCapitalGainOnly = filtered.length === 0;

    // Divergence Warning logic
    const portfolioTrend = chartData.length >= 2
      ? chartData[chartData.length - 1].Portfolio > chartData[0].Portfolio
      : false;
    const priceTrend = filteredPrices.length >= 2
      ? filteredPrices[filteredPrices.length - 1].Price < filteredPrices[0].Price
      : false;
    const isDivergent = portfolioTrend && priceTrend;

    // Real Yield Calculation
    const yields = filtered.map(r => ((r.Dividend || 0) / (r.Cum_Price || 1)));
    const avgYield = (yields.reduce((s, y) => s + y, 0) / (yields.length || 1)) * 100;

    return {
      shares: investStyle === "lumpsum" ? Math.floor(amount / (monthlyForTicker[0]?.Price || 1)) : currentShares,
      currentShares, totalDiv, portfolioValue, depositValue, totalInvested,
      totalReturn, netProfit, avgRecovery, notRecovered, yearly, chartData, years, avgYield, isDivergent, isCapitalGainOnly
    };
  }, [filtered, amount, investStyle, divStrategy, latestPrice, priceData, ticker, startYear, startMonth]);

  const health = useMemo(() => calculateHealthScore(filtered), [filtered]);

  // ── SEO Dynamic Title & Meta ──────────────────────────────────────────────
  useEffect(() => {
    if (engine) {
      const stockName = STOCKS_INFO[ticker]?.name || "";
      // Update Title
      document.title = `${ticker} - Dividend Trap Analysis & Total Return | Dividown`;

      // Update Meta Description
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.name = "description";
        document.head.appendChild(metaDescription);
      }

      const returnText = engine.totalReturn !== undefined ? `Total return: ${pct(engine.totalReturn)}.` : "";
      const healthText = health ? `Health Score: ${health.score}/100.` : "";
      const recoveryText = engine.avgRecovery ? `Rata-rata recovery: ${Math.round(engine.avgRecovery)} hari.` : "";

      metaDescription.content = `Analisis mendalam saham ${ticker} (${stockName}). ${healthText} ${recoveryText} ${returnText} Cek apakah ${ticker} layak investasi atau hanya jebakan dividen (Dividend Trap) di Dividown.`;
    }

    return () => {
      document.title = "Dividown — Deteksi Dividend Trap & Hitung Total Return Saham IHSG";
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.content = "Validasi apakah saham dividenmu benar-benar untung atau justru jebakan harga (Trap). Analisis recovery harga 50 emiten unggulan.";
      }
    };
  }, [ticker, engine, health]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 tracking-wide font-sans font-medium">Menganalisis data pasar…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans bg-slate-50 min-h-screen">
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-12 space-y-3 md:space-y-4">

        {/* ── HEADER ── */}
        <div className="flex flex-col gap-6 mb-6 md:mb-8">
          <button
            onClick={() => navigate('/')}
            className="group inline-flex items-center gap-2 text-sm font-bold text-indigo-600 transition-colors cursor-pointer w-fit"
          >
            <div className="p-1.5 rounded-full bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            Back to Discovery
          </button>

          <div className="flex flex-row items-start md:items-end justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-col">
                <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                  <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-none shrink-0">{ticker}</h1>
                  {health && (
                    <div className="relative shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMobileTooltip(activeMobileTooltip === 'health-info' ? null : 'health-info');
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold ring-1 cursor-pointer transition-all hover:scale-105 ${health.badgeClass}`}
                      >
                        <health.Icon className="w-3.5 h-3.5" />
                        {health.label}
                      </button>
                      {activeMobileTooltip === 'health-info' && (
                        <div className="absolute top-full left-0 mt-3 w-72 bg-slate-900 text-white text-xs p-4 rounded-2xl shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-200">
                          <div className="absolute top-0 left-6 -translate-y-1/2 rotate-45 w-2.5 h-2.5 bg-slate-900" />
                          <p className="font-bold mb-1 text-slate-300 uppercase tracking-widest text-[9px]">Status Reason</p>
                          <p className="leading-relaxed">{health.reason}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-[10px] md:text-sm font-bold text-slate-400 mt-2 uppercase tracking-widest truncate">
                  {STOCKS_INFO[ticker]?.name || ""}
                </p>
              </div>
            </div>

            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all active:scale-95 group h-fit shrink-0 mt-1 md:mt-0"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">
                {copied ? "Copied!" : "Share Link"}
              </span>
            </button>
          </div>
        </div>

        {/* ── SIMULATION CONTROL PANEL ── */}
        <section className="bg-white border border-slate-200/60 rounded-2xl p-4 md:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Activity className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Simulasi Investasi</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Nominal Rupiah */}
            <div className="space-y-3">
              <label htmlFor="amount-input" className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                {investStyle === "lumpsum" ? "Modal Awal" : "Setoran Bulanan"}
              </label>
              <div className="relative">
                <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="amount-input"
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

            {/* 2. Metode Investasi */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Metode Investasi
              </label>
              <div className="flex rounded-2xl border border-slate-200/60 overflow-hidden bg-slate-50 p-1">
                {[{ key: "lumpsum", label: "Sekali Beli" }, { key: "dca", label: "Nabung Rutin" }].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setInvestStyle(s.key)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${investStyle === s.key
                      ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/40"
                      : "text-slate-500 hover:text-slate-900"
                      }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Waktu Mulai */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Waktu Mulai
              </label>
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setIsYearOpen(!isYearOpen)}
                  className="w-full flex items-center justify-between bg-slate-50 border border-slate-200/60 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-900 hover:border-indigo-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    <span>{MONTHS[startMonth - 1]} {startYear}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isYearOpen ? "rotate-180" : ""}`} />
                </button>

                {isYearOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2">
                      <div className="flex items-center justify-between mb-2 bg-slate-50 p-1.5 rounded-xl">
                        <button
                          onClick={() => setStartYear(prev => Math.max(2021, prev - 1))}
                          className="p-1 hover:bg-white rounded-lg transition-colors cursor-pointer disabled:opacity-30"
                          disabled={startYear <= 2021}
                        >
                          <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                        </button>
                        <span className="text-xs font-bold text-slate-900">{startYear}</span>
                        <button
                          onClick={() => setStartYear(prev => Math.min(2026, prev + 1))}
                          className="p-1 hover:bg-white rounded-lg transition-colors cursor-pointer disabled:opacity-30"
                          disabled={startYear >= 2026}
                        >
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-1">
                        {MONTHS.map((m, idx) => {
                          const mIdx = idx + 1;
                          const isSelected = startMonth === mIdx;
                          return (
                            <button
                              key={m}
                              onClick={() => {
                                setStartMonth(mIdx);
                                setIsYearOpen(false);
                              }}
                              className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${isSelected
                                ? "bg-indigo-600 text-white"
                                : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
                                }`}
                            >
                              {m.substring(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Strategi Dividen */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                Strategi Dividen
                {divStrategy === "passive" && (
                  <span className="text-[10px] text-rose-500 font-bold normal-case tracking-normal animate-pulse">Potong Pajak 10%</span>
                )}
              </label>
              <div className="flex rounded-2xl border border-slate-200/60 overflow-hidden bg-slate-50 p-1">
                {[{ key: "compound", label: "Putar Kembali" }, { key: "passive", label: "Cairkan" }].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setDivStrategy(s.key)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${divStrategy === s.key
                      ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/40"
                      : "text-slate-500 hover:text-slate-900"
                      }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {engine && engine.isCapitalGainOnly && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[10px] md:text-xs text-slate-400 font-medium italic flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                Simulasi saat ini hanya mencakup Capital Gain karena belum ada pembagian dividen di periode terpilih.
              </p>
            </div>
          )}
        </section>

        {engine && engine.isDivergent && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-amber-900">Portfolio Divergence Warning</p>
              <p className="text-xs font-medium text-amber-700 leading-relaxed">
                Warning: Pertumbuhan portfolio Anda saat ini hanya ditopang oleh akumulasi dividen (Yield Support), sementara nilai aset dasar Anda (Capital) sedang mengalami penurunan signifikan.
              </p>
            </div>
          </div>
        )}

        {engine && (
          <div className="space-y-3 md:space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* ── METRIC CARDS ── */}
            <div id="metrics" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <MetricCard
                icon={TrendingUp}
                label="Total Return"
                value={pct(engine.totalReturn)}
                sub={`vs Deposito Bank 4% p.a: ${pct(((engine.depositValue - engine.totalInvested) / engine.totalInvested) * 100)}`}
                positive={engine.totalReturn >= 0}
              />
              <MetricCard
                icon={Banknote}
                label="Net Profit"
                value={fmt(engine.netProfit)}
                sub={`Total investment ${fmt(engine.totalInvested)}`}
                positive={engine.netProfit >= 0}
              />
              <MetricCard
                icon={Clock}
                label="Avg Recovery"
                value={`${Math.round(engine.avgRecovery)} hari`}
                sub={`${engine.notRecovered} traps detected`}
                positive={engine.avgRecovery <= 30}
              />
            </div>

            {/* ── CHART ── */}
            <div id="chart" className="bg-white border border-slate-200/60 rounded-3xl p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-6">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Portfolio Performance</h2>
                  <p className="text-sm font-medium text-slate-500">Perbandingan nilai vs Deposito Bank (4% p.a)</p>
                </div>
                <div className="flex items-center gap-6 bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100">
                  <LegendDot color="bg-indigo-500" label="Portfolio" />
                  <LegendDot color="bg-slate-300" label="Deposito Bank" />
                </div>
              </div>
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={engine.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gPortfolio" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gDeposit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.05} />
                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="id"
                      tickFormatter={(id) => engine.chartData[id]?.year}
                      tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${(v / 1e6).toFixed(0)}jt`}
                      width={45}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1.5, strokeDasharray: '4 4' }} />
                    <Area
                      type="monotone"
                      dataKey="Portfolio"
                      stroke="#4f46e5"
                      strokeWidth={3.5}
                      fill="url(#gPortfolio)"
                      dot={{ r: 5, fill: "#4f46e5", stroke: "#fff", strokeWidth: 2.5 }}
                      activeDot={{ r: 7, fill: "#4f46e5", stroke: "#fff", strokeWidth: 3 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Deposito"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      fill="url(#gDeposit)"
                      dot={false}
                      activeDot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── PRICE HISTORY CHART ── */}
            {filteredPrices?.length > 0 && (
              <div id="price-chart" className="bg-white border border-slate-200/60 rounded-3xl p-4 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-6">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">Market Price History</h2>
                    <p className="text-sm font-medium text-slate-500">Monthly closing price verification</p>
                  </div>
                  <div className="flex items-center gap-4 bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100">
                    <LegendDot color="bg-slate-400" label="Price (IDR)" />
                  </div>
                </div>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredPrices} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#cbd5e1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f8fafc" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="Date"
                        tickFormatter={(val) => {
                          const d = new Date(val);
                          const m = MONTHS[d.getMonth()].substring(0, 3);
                          const y = d.getFullYear().toString().slice(-2);
                          return `${m} ${y}`;
                        }}
                        tick={{ fontSize: 10, fill: "#64748b", fontWeight: 600 }}
                        interval={isMobile ? 11 : 2}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => v.toLocaleString("id-ID")}
                        width={55}
                      />
                      <Tooltip content={<CustomPriceTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1.5 }} />
                      <Area
                        type="monotone"
                        dataKey="Price"
                        name="Market Price"
                        stroke="#94a3b8"
                        strokeWidth={2.5}
                        fill="url(#gPrice)"
                        activeDot={{ r: 6, fill: "#fff", stroke: "#94a3b8", strokeWidth: 2.5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── SUMMARY ROW ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              <MiniStat icon={BarChart3} label="Owned Shares" value={engine.currentShares.toLocaleString("id-ID")} />
              <MiniStat icon={Banknote} label="Total Dividends" value={fmt(engine.totalDiv)} />
              <MiniStat icon={Wallet} label="Portfolio Value" value={fmt(engine.portfolioValue)} />
              <MiniStat icon={Activity} label="Simulasi Deposito" value={fmt(engine.depositValue)} />
            </div>

            {/* ── HISTORY TABLE ── */}
            <section id="history" className="bg-white border border-slate-200/60 rounded-3xl overflow-hidden">
              <div className="px-4 md:px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Dividend Event History</h2>
                <p className="text-sm font-medium text-slate-500 mt-0.5">{filtered.length} historical records analyzed</p>
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white border-b border-slate-100">
                    <tr>
                      {["Year", "Cum Date", "Cum Price", "Ex Price", "Drop", "Recovery", "Status"].map((h, i) => (
                        <th
                          key={h}
                          className={`px-4 md:px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest ${i >= 2 ? "text-right" : "text-left"} ${i === 6 ? "text-center" : ""}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {engine.yearly.map((row) => {
                      const drop = ((row.Ex_Price_1day - row.Cum_Price) / row.Cum_Price) * 100;
                      return (
                        <tr key={`${row.Ticker}-${row.Year}-${row.Cum_Date}`} className="group hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 md:px-8 py-5 font-bold text-slate-900">{row.Year}</td>
                          <td className="px-4 md:px-8 py-5 text-slate-500 font-semibold">{row.Cum_Date}</td>
                          <td className="px-4 md:px-8 py-5 text-right text-slate-700 font-bold">{row.Cum_Price.toLocaleString("id-ID")}</td>
                          <td className="px-4 md:px-8 py-5 text-right text-slate-700 font-bold">{row.Ex_Price_1day.toLocaleString("id-ID")}</td>
                          <td className={`px-4 md:px-8 py-5 text-right font-bold ${drop < -3 ? "text-rose-600" : "text-slate-500"}`}>
                            {drop.toFixed(1)}%
                          </td>
                          <td className={`px-4 md:px-8 py-5 text-right font-extrabold ${row.hasRecoveredOnce ? (row.Recovery_Days > 40 ? "text-rose-600" : "text-emerald-500") : "text-slate-400"}`}>
                            {row.recoveryDisplay}
                          </td>
                          <td className="px-4 md:px-8 py-5 text-center">
                            {row.newStatus === "RECOVERED" && (
                              <div className="relative inline-block">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const key = `d-rec-${row.Ticker}-${row.Year}-${row.Cum_Date}`;
                                    setActiveMobileTooltip(activeMobileTooltip === key ? null : key);
                                  }}
                                  className="inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> RECOVERED
                                </button>
                                {activeMobileTooltip === `d-rec-${row.Ticker}-${row.Year}-${row.Cum_Date}` && (
                                  <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-900 text-white text-xs p-3 rounded-xl shadow-xl z-[100] animate-in fade-in zoom-in-95 duration-200">
                                    <div className="absolute bottom-0 right-6 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900" />
                                    Saham berhasil pulih ke level harga Cum Date dalam {row.Recovery_Days} hari dan saat ini harganya masih terjaga.
                                  </div>
                                )}
                              </div>
                            )}
                            {row.newStatus === "DROP AGAIN" && (
                              <div className="relative inline-block">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const key = `d-drop-${row.Ticker}-${row.Year}-${row.Cum_Date}`;
                                    setActiveMobileTooltip(activeMobileTooltip === key ? null : key);
                                  }}
                                  className="inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 cursor-pointer"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" /> DROP AGAIN
                                </button>
                                {activeMobileTooltip === `d-drop-${row.Ticker}-${row.Year}-${row.Cum_Date}` && (
                                  <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-900 text-white text-xs p-3 rounded-xl shadow-xl z-[100] animate-in fade-in zoom-in-95 duration-200">
                                    <div className="absolute bottom-0 right-6 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900" />
                                    Saham ini sempat pulih dalam {row.Recovery_Days} hari, namun tren harga saat ini melemah kembali ke Rp {latestPrice.toLocaleString("id-ID")}, di bawah modal Cum Date tahun tersebut.
                                  </div>
                                )}
                              </div>
                            )}
                            {row.newStatus === "DIVIDEND TRAP" && (
                              <div className="relative inline-block">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const key = `d-trap-${row.Ticker}-${row.Year}-${row.Cum_Date}`;
                                    setActiveMobileTooltip(activeMobileTooltip === key ? null : key);
                                  }}
                                  className="inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100 cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> DIVIDEND TRAP
                                </button>
                                {activeMobileTooltip === `d-trap-${row.Ticker}-${row.Year}-${row.Cum_Date}` && (
                                  <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-900 text-white text-xs p-3 rounded-xl shadow-xl z-[100] animate-in fade-in zoom-in-95 duration-200">
                                    <div className="absolute bottom-0 right-6 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900" />
                                    Harga saham tidak pernah kembali ke level Cum Date setelah lebih dari 1 tahun. Dividen ini menjadi jebakan modal.
                                  </div>
                                )}
                              </div>
                            )}
                            {row.newStatus === "BERPROSES" && (
                              <div className="relative inline-block">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const key = `d-proc-${row.Ticker}-${row.Year}-${row.Cum_Date}`;
                                    setActiveMobileTooltip(activeMobileTooltip === key ? null : key);
                                  }}
                                  className="inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100 cursor-pointer"
                                >
                                  <Clock className="w-3.5 h-3.5" /> BERPROSES
                                </button>
                                {activeMobileTooltip === `d-proc-${row.Ticker}-${row.Year}-${row.Cum_Date}` && (
                                  <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-900 text-white text-xs p-3 rounded-xl shadow-xl z-[100] animate-in fade-in zoom-in-95 duration-200">
                                    <div className="absolute bottom-0 right-6 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900" />
                                    Saham belum pulih ke level Cum Date, namun durasi saat ini masih di bawah 1 tahun.
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-slate-100 bg-white">
                {engine.yearly.map((row) => {
                  const drop = ((row.Ex_Price_1day - row.Cum_Price) / row.Cum_Price) * 100;
                  return (
                    <div key={`m-${row.Ticker}-${row.Year}-${row.Cum_Date}`} className="px-4 py-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-lg leading-tight">{row.Year}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{row.Cum_Date}</span>
                        </div>
                        {row.newStatus === "RECOVERED" && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const key = `m-rec-${row.Ticker}-${row.Year}-${row.Cum_Date}`;
                                setActiveMobileTooltip(activeMobileTooltip === key ? null : key);
                              }}
                              className="inline-flex items-center gap-1 text-[9px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3" /> RECOVERED
                            </button>
                            {activeMobileTooltip === `m-rec-${row.Ticker}-${row.Year}-${row.Cum_Date}` && (
                              <div className="absolute bottom-full right-0 mb-2 w-64 bg-slate-900 text-white text-[10px] p-3 rounded-xl shadow-xl z-[100] animate-in fade-in zoom-in-95 duration-200">
                                <div className="absolute bottom-0 right-4 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900" />
                                {`Saham berhasil pulih ke level harga Cum Date dalam ${row.Recovery_Days} hari dan saat ini harganya masih terjaga.`}
                              </div>
                            )}
                          </div>
                        )}
                        {row.newStatus === "DROP AGAIN" && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const key = `m-${row.Ticker}-${row.Year}-${row.Cum_Date}`;
                                setActiveMobileTooltip(activeMobileTooltip === key ? null : key);
                              }}
                              className="inline-flex items-center gap-1 text-[9px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100 cursor-pointer"
                            >
                              <AlertTriangle className="w-3 h-3" /> DROP AGAIN
                            </button>

                            {activeMobileTooltip === `m-${row.Ticker}-${row.Year}-${row.Cum_Date}` && (
                              <div className="absolute bottom-full right-0 mb-2 w-64 bg-slate-900 text-white text-[10px] p-3 rounded-xl shadow-xl z-[100] animate-in fade-in zoom-in-95 duration-200">
                                <div className="absolute bottom-0 right-4 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900" />
                                {`Saham ini sempat pulih dalam ${row.Recovery_Days} hari, namun tren harga saat ini melemah kembali ke Rp ${latestPrice.toLocaleString("id-ID")}, di bawah modal Cum Date tahun tersebut.`}
                              </div>
                            )}
                          </div>
                        )}
                        {row.newStatus === "DIVIDEND TRAP" && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const key = `m-trap-${row.Ticker}-${row.Year}-${row.Cum_Date}`;
                                setActiveMobileTooltip(activeMobileTooltip === key ? null : key);
                              }}
                              className="inline-flex items-center gap-1 text-[9px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100 cursor-pointer"
                            >
                              <XCircle className="w-3 h-3" /> DIVIDEND TRAP
                            </button>
                            {activeMobileTooltip === `m-trap-${row.Ticker}-${row.Year}-${row.Cum_Date}` && (
                              <div className="absolute bottom-full right-0 mb-2 w-64 bg-slate-900 text-white text-[10px] p-3 rounded-xl shadow-xl z-[100] animate-in fade-in zoom-in-95 duration-200">
                                <div className="absolute bottom-0 right-4 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900" />
                                {`Harga saham tidak pernah kembali ke level Cum Date setelah lebih dari 1 tahun. Dividen ini menjadi jebakan modal.`}
                              </div>
                            )}
                          </div>
                        )}
                        {row.newStatus === "BERPROSES" && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const key = `m-proc-${row.Ticker}-${row.Year}-${row.Cum_Date}`;
                                setActiveMobileTooltip(activeMobileTooltip === key ? null : key);
                              }}
                              className="inline-flex items-center gap-1 text-[9px] font-bold px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-100 cursor-pointer"
                            >
                              <Clock className="w-3 h-3" /> BERPROSES
                            </button>
                            {activeMobileTooltip === `m-proc-${row.Ticker}-${row.Year}-${row.Cum_Date}` && (
                              <div className="absolute bottom-full right-0 mb-2 w-64 bg-slate-900 text-white text-[10px] p-3 rounded-xl shadow-xl z-[100] animate-in fade-in zoom-in-95 duration-200">
                                <div className="absolute bottom-0 right-4 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900" />
                                {`Saham belum pulih ke level Cum Date, namun durasi saat ini masih di bawah 1 tahun.`}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between bg-slate-50/50 rounded-xl px-4 py-2.5 border border-slate-100/50">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-0.5">Cum Price</span>
                          <span className="text-xs font-bold text-slate-900">{row.Cum_Price.toLocaleString("id-ID")}</span>
                        </div>
                        <div className="w-px h-6 bg-slate-200" />
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-0.5">Drop</span>
                          <span className={`text-xs font-bold ${drop < -3 ? "text-rose-600" : "text-slate-900"}`}>{drop.toFixed(1)}%</span>
                        </div>
                        <div className="w-px h-6 bg-slate-200" />
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-0.5">Recovery</span>
                          <span className={`text-xs font-extrabold ${row.hasRecoveredOnce ? (row.Recovery_Days > 40 ? "text-rose-600" : "text-emerald-500") : "text-slate-900"}`}>{row.recoveryDisplay}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

      </main>
      <Analytics />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, sub, positive }) {
  return (
    <div className="bg-white border border-slate-200/60 rounded-2xl p-4 md:p-5 transition-all hover:-translate-y-1 group">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">{label}</span>
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${positive ? "bg-emerald-50 group-hover:bg-emerald-100" : "bg-rose-50 group-hover:bg-rose-100"}`}>
          <Icon className={`w-5 h-5 ${positive ? "text-emerald-600" : "text-rose-600"}`} />
        </div>
      </div>
      <p className={`text-3xl font-extrabold tracking-tight ${positive ? "text-emerald-600" : "text-rose-600"}`}>{value}</p>
      <p className="text-xs font-bold text-slate-400 mt-3 uppercase tracking-wider">{sub}</p>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="bg-white border border-slate-200/60 rounded-3xl p-4 md:p-5 flex items-center gap-4 transition-all">
      <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
        <Icon className="w-6 h-6 text-indigo-600" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-base font-extrabold text-slate-900 truncate">{value}</p>
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
