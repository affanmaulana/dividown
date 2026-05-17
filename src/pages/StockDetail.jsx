import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, Banknote, Clock, Wallet, BarChart3,
  Activity, CheckCircle2, XCircle, ChevronDown, AlertTriangle, TriangleAlert,
  Calendar, ChevronLeft, ChevronRight, Share2, Check, ArrowUp,
  Maximize2, Minimize2, Crown, Sparkles
} from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
import { calculateHealthScore } from "../utils/healthScore";
import Skeleton from "../components/Skeleton";
import { STOCKS_INFO } from "../constants/stocks";

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

const getMedian = (values) => {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

// ── Custom Tooltip ─────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const dataPoint = payload[0]?.payload || {};
  const dividendType = dataPoint.dividendType || "";
  const rawDate = dataPoint.displayDate || dataPoint.year || "";
  const displayDate = (rawDate === "Hari Ini" || !rawDate) 
    ? rawDate 
    : new Date(rawDate).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const typeClass = dividendType === "Final Dividend" ? "text-emerald-700" : "text-indigo-700";
  const hasDividend = dataPoint.hasDividend;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-xl p-4 font-sans ring-1 ring-slate-900/5">
      <div className="flex justify-between items-center mb-1">
        <p className="font-semibold text-slate-900">{displayDate}</p>
        {dataPoint.isToday && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase tracking-widest">Today</span>}
      </div>
      
      {hasDividend && (
        <>
          {dividendType && (
            <p className={`text-[10px] uppercase tracking-wider font-bold ${typeClass} mb-3`}>{dividendType}</p>
          )}
          <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-50 mb-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cum Price</span>
              <span className="font-bold text-slate-700">{dataPoint.Cum_Price?.toLocaleString("id-ID") || "-"}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ex Price</span>
              <span className="font-bold text-slate-700">{dataPoint.Ex_Price_1day?.toLocaleString("id-ID") || "-"}</span>
            </div>
          </div>
          <div className="flex justify-between items-center mb-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dividend Drop</span>
              <span className={`font-bold ${(dataPoint.Cum_Price && dataPoint.Ex_Price_1day) && (((dataPoint.Ex_Price_1day - dataPoint.Cum_Price) / dataPoint.Cum_Price) * 100) < -3 ? "text-rose-600" : "text-slate-500"}`}>
                {(dataPoint.Cum_Price && dataPoint.Ex_Price_1day) ? `${(((dataPoint.Ex_Price_1day - dataPoint.Cum_Price) / dataPoint.Cum_Price) * 100)?.toFixed(1)}%` : "-"}
              </span>
            </div>
          </div>
        </>
      )}

      <div className="space-y-2 mt-1">
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
  const rawDate = dataPoint.Date || label || "";
  const displayDate = !rawDate 
    ? rawDate 
    : new Date(rawDate).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

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
  const [status, setStatus] = useState(null);
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

  // Stable dot renderers to prevent chart re-render lag
  const renderDividendDot = useCallback((props) => {
    if (props.payload.hasDividend) {
      return <circle key={`dot-${props.index}`} cx={props.cx} cy={props.cy} r={5} fill="var(--color-emerald-500)" stroke="white" strokeWidth={2.5} />;
    }
    return null;
  }, []);
  const renderDividendDotFull = useCallback((props) => {
    if (props.payload.hasDividend) {
      return <circle key={`dot-f-${props.index}`} cx={props.cx} cy={props.cy} r={6} fill="var(--color-emerald-500)" stroke="white" strokeWidth={3} />;
    }
    return null;
  }, []);

  // Stable formatters to prevent re-renders
  const xAxisFormatter = useCallback((val) => {
    const d = new Date(val);
    return `${d.getMonth() + 1}/${d.getFullYear().toString().slice(-2)}`;
  }, []);
  const yAxisPortfolioFormatter = useCallback((v) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}jt` : v.toLocaleString("id-ID"), []);
  const yAxisPriceFormatter = useCallback((v) => v.toLocaleString("id-ID"), []);
  const [loading, setLoading] = useState(true);
  const [isYearOpen, setIsYearOpen] = useState(false);
  const [activeMobileTooltip, setActiveMobileTooltip] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(isMobile);
  const [fullscreenChart, setFullscreenChart] = useState(null); // 'portfolio' or 'price'
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsPanelCollapsed(false);
    };
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

  // Fullscreen Chart: Body Scroll Lock & ESC shortcut
  useEffect(() => {
    if (fullscreenChart) {
      document.body.style.overflow = 'hidden';
      const handleEsc = (e) => {
        if (e.key === 'Escape') setFullscreenChart(null);
      };
      window.addEventListener('keydown', handleEsc);
      return () => {
        document.body.style.overflow = 'unset';
        window.removeEventListener('keydown', handleEsc);
      };
    }
  }, [fullscreenChart]);

  useEffect(() => {
    Promise.all([
      fetch("/data/dividend_recovery.json").then((r) => r.json()),
      fetch("/data/stock_prices.json").then((r) => r.json()),
      fetch("/data/status.json").then((r) => r.ok ? r.json() : null).catch(() => null)
    ])
      .then(([dDiv, dPrice, dStatus]) => {
        const enriched = dDiv.map((row) => {
          const date = new Date(row.Cum_Date);
          const month = date.getMonth() + 1;
          const dividendType = (month === 3 || month === 4) ? "Final Dividend" : (month === 11 || month === 12) ? "Interim Dividend" : "";
          return { ...row, dividendType };
        });
        setData(enriched);
        setPriceData(dPrice);
        setStatus(dStatus);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ticker]); // Re-fetch or re-check when ticker changes

  // Data Integrity Check for StockDetail
  const isDataIncomplete = useMemo(() => {
    if (loading) return false;
    const tickerExists = Object.keys(STOCKS_INFO).includes(ticker);
    const hasDivData = data.some(d => d.Ticker === ticker);
    const hasPriceData = priceData.some(p => p.Ticker === ticker);

    // If the ticker is known but has no data, it's incomplete
    if (tickerExists && (!hasDivData || !hasPriceData)) return true;
    // If the ticker is completely unknown, also show error/not found
    if (!tickerExists) return true;

    return false;
  }, [loading, ticker, data, priceData]);



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
        return p.Ticker === ticker && (pYear > startYear || (pYear === startYear && pMonth >= startMonth));
      }),
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
    let investCash = 0;      // Cash available for buying shares (DCA leftovers, compound reinvest leftovers)
    let dividendCash = 0;    // Cash from passive dividends (never used to buy shares)
    const today = new Date();

    // 1. Pre-filter and optimize lookup data
    const tickerPrices = priceData.filter(p => p.Ticker === ticker);
    
    // Group dividends by "YYYY-MM" for O(1) lookup during simulation
    const divLookup = new Map();
    filtered.forEach(d => {
      const dDate = new Date(d.Cum_Date);
      const key = `${dDate.getFullYear()}-${dDate.getMonth()}`;
      if (!divLookup.has(key)) divLookup.set(key, []);
      divLookup.get(key).push(d);
    });

    const monthlyForTicker = tickerPrices
      .filter(p => {
        const pDate = new Date(p.Date);
        const pYear = pDate.getFullYear();
        const pMonth = pDate.getMonth() + 1;
        return pYear > startYear || (pYear === startYear && pMonth >= startMonth);
      })
      .sort((a, b) => new Date(a.Date) - new Date(b.Date));

    if (monthlyForTicker.length === 0) return null;

    // Simulation logic
    const processedYearly = [];
    const chartData = [];
    
    // Initial setup
    if (investStyle === "lumpsum") {
      const startPrice = monthlyForTicker[0]?.Price;
      currentShares = Math.floor(amount / startPrice);
      investCash = amount - (currentShares * startPrice);
      totalInvested = amount;
    }

    monthlyForTicker.forEach((mp, index) => {
      const monthDate = new Date(mp.Date);
      
      // 1. DCA Contribution — only investCash is used to buy shares
      if (investStyle === "dca") {
        investCash += amount;
        totalInvested += amount;
        const newShares = Math.floor(investCash / mp.Price);
        currentShares += newShares;
        investCash -= (newShares * mp.Price);
      }

      // 2. Find and process dividends in this month (O(1) lookup)
      const monthKey = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
      const monthDivs = divLookup.get(monthKey) || [];

      monthDivs.forEach(row => {
        const taxFactor = divStrategy === "passive" ? 0.9 : 1.0;
        const divPerShare = (row.Dividend || (row.Cum_Price * 0.05)) * taxFactor;
        const divPayout = Math.round(currentShares * divPerShare);
        totalDiv += divPayout;

        if (divStrategy === "compound") {
          // Reinvest: buy more shares, leftover stays in investCash
          const reinvestShares = Math.floor(divPayout / row.Cum_Price);
          currentShares += reinvestShares;
          investCash += (divPayout - (reinvestShares * row.Cum_Price));
        } else {
          // Passive: dividends go to separate cash pool, NEVER used to buy shares
          dividendCash += divPayout;
        }

        // Status logic for the table
        const cumDate = new Date(row.Cum_Date);
        const ageInDays = Math.floor((today - cumDate) / (1000 * 60 * 60 * 24));
        const hasRecoveredOnce = row.Status_Recovery === "Pulih";
        const isDroppedNow = latestPrice < (row.Cum_Price * 0.95);
        let newStatus = hasRecoveredOnce ? (isDroppedNow ? "DROP AGAIN" : "RECOVERED") : (ageInDays > 60 ? "DIVIDEND TRAP" : "BERPROSES");
        const recoveryDisplay = hasRecoveredOnce ? `${row.Recovery_Days || 0}d` : `${ageInDays}d++`;

        processedYearly.push({
          ...row,
          divPerShare,
          divPayout,
          divYield: (row.Dividend / (row.Cum_Price || 1)) * 100,
          sharesAfter: currentShares,
          totalDivSoFar: totalDiv,
          newStatus,
          recoveryDisplay,
          hasRecoveredOnce
        });
      });

      // 3. Record month-end portfolio value
      const portfolioValue = Math.round(currentShares * mp.Price + investCash + dividendCash);
      const monthsSinceStart = index;
      const depositValue = Math.round(totalInvested * Math.pow(1 + (DEPOSIT_RATE / 12), monthsSinceStart));

      chartData.push({
        id: index,
        Date: mp.Date,
        displayDate: mp.Date, // Keep raw date, format in UI to save CPU
        year: monthDate.getFullYear(),
        Portfolio: portfolioValue,
        Deposito: depositValue,
        hasDividend: monthDivs.length > 0,
        // Carry over details from the first dividend in month for the tooltip
        ...(monthDivs.length > 0 ? {
          dividendType: monthDivs[0].dividendType,
          Cum_Price: monthDivs[0].Cum_Price,
          Ex_Price_1day: monthDivs[0].Ex_Price_1day
        } : {})
      });
    });

    // 4. Add "Today" point (if different from last monthly point)
    const lastPoint = chartData[chartData.length - 1];
    const todayStr = today.toISOString().split('T')[0];
    if (lastPoint && lastPoint.Date !== todayStr) {
      chartData.push({
        id: 'today',
        Date: todayStr,
        displayDate: 'Hari Ini',
        year: today.getFullYear(),
        Portfolio: Math.round(currentShares * latestPrice + investCash + dividendCash),
        Deposito: Math.round(totalInvested * Math.pow(1 + (DEPOSIT_RATE / 12), chartData.length)),
        hasDividend: false,
        isToday: true
      });
    }

    const finalPoint = chartData[chartData.length - 1];
    const portfolioValue = finalPoint.Portfolio;
    const depositValue = finalPoint.Deposito;
    const netProfit = portfolioValue - totalInvested;
    const totalReturn = totalInvested > 0 ? ((portfolioValue - totalInvested) / totalInvested) * 100 : 0;

    const recoveryDays = filtered.map(r => r.Recovery_Days || 0);
    const medianRecovery = getMedian(recoveryDays);
    const drops = filtered.map(r => {
      const cp = r.Cum_Price || 1;
      return Math.abs((((r.Ex_Price_1day || cp) - cp) / cp) * 100);
    });
    const meanDrop = drops.length > 0 ? drops.reduce((s, d) => s + d, 0) / drops.length : 0;
    const notRecovered = filtered.filter((r) => r.Status_Recovery === "Trap").length;
    const isCapitalGainOnly = filtered.length === 0;

    // Divergence Warning logic
    const portfolioTrend = chartData.length >= 2 ? chartData[chartData.length - 1].Portfolio > chartData[0].Portfolio : false;
    const priceTrend = filteredPrices.length >= 2 ? filteredPrices[filteredPrices.length - 1].Price < filteredPrices[0].Price : false;
    const isDivergent = portfolioTrend && priceTrend;

    const yields = filtered.map(r => ((r.Dividend || 0) / (r.Cum_Price || 1)));
    const avgYield = (yields.reduce((s, y) => s + y, 0) / (yields.length || 1)) * 100;

    return {
      shares: currentShares,
      currentShares, totalDiv, portfolioValue, depositValue, totalInvested,
      totalReturn, netProfit, medianRecovery, meanDrop, notRecovered, yearly: processedYearly, chartData, avgYield, isDivergent, isCapitalGainOnly
    };
  }, [filtered, amount, investStyle, divStrategy, latestPrice, priceData, ticker, startYear, startMonth]);

  const health = useMemo(() => calculateHealthScore(filtered, latestPrice), [filtered, latestPrice]);

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
      const recoveryText = engine.medianRecovery ? `Median recovery: ${Math.round(engine.medianRecovery)} hari.` : "";

      metaDescription.content = `Analisis mendalam saham ${ticker} (${stockName}). ${healthText} ${recoveryText} ${returnText} Cek apakah ${ticker} layak investasi atau hanya jebakan dividen (Dividend Trap) di Dividown.`;
    }

    return () => {
      document.title = "Dividown | Kalkulator Dividen Saham IHSG & Deteksi Dividend Trap";
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.content = "Kalkulator dividen saham IHSG gratis untuk mendeteksi dividend trap. Temukan cara menghitung dividen trap & cara hitung yield dividen BBRI BMRI secara cepat & akurat!";
      }
    };
  }, [ticker, engine, health]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="font-sans bg-slate-50 min-h-screen">
        <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-8">
          {/* Header Skeleton */}
          <div className="space-y-6">
            <Skeleton className="w-32 h-6 rounded-full" />
            <div className="flex justify-between items-end">
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-48 h-16" />
                  <Skeleton className="w-24 h-8 rounded-full" />
                </div>
                <Skeleton className="w-32 h-4" />
              </div>
              <Skeleton className="w-32 h-10 rounded-xl" />
            </div>
          </div>

          {/* Simulation Panel Skeleton */}
          <Skeleton className="w-full h-48 rounded-2xl" />

          {/* Metrics Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
          </div>

          {/* Chart Skeleton */}
          <Skeleton className="w-full h-[400px] rounded-3xl" />
        </main>
      </div>
    );
  }

  if (isDataIncomplete) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4 font-sans bg-slate-50">
        <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="w-12 h-12" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-slate-900">
          Data Saham Tidak Ditemukan
        </h1>
        <p className="text-slate-500 text-lg max-w-md mx-auto mb-8 leading-relaxed">
          Maaf, data untuk saham <span className="font-bold text-slate-900">{ticker}</span> sedang tidak tersedia atau dalam proses pembaruan.
        </p>
        <button
          onClick={() => navigate('/')}
          className="btn-primary"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  if (!engine) return null; // Fallback for edge cases where data exists but engine fails

  return (
    <div className="font-sans bg-slate-50 min-h-screen">
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-4 space-y-3 md:space-y-4">

        {/* ── HEADER ── */}
        <div className="flex flex-col gap-6 mb-6 md:mb-8">
          <button
            onClick={() => navigate('/')}
            className="btn-secondary w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Discovery
          </button>

          <div className="flex flex-row items-start md:items-end justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-col">
                <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                  <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-none shrink-0">{ticker}</h1>
                  {health && (
                    <div className="flex items-center gap-2 relative">
                      {health.isBearish && (
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMobileTooltip(activeMobileTooltip === 'bearish-info' ? null : 'bearish-info');
                            }}
                            className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center cursor-pointer transition-all active:scale-95"
                          >
                            <TrendingDown className="w-6 h-6" />
                          </button>
                          {activeMobileTooltip === 'bearish-info' && (
                            <div className="absolute top-full left-0 mt-3 w-72 bg-slate-900 text-white text-xs p-4 rounded-2xl z-[100] animate-in fade-in zoom-in-95 duration-200">
                              <div className="absolute top-0 left-6 -translate-y-1/2 rotate-45 w-2.5 h-2.5 bg-slate-900" />
                              <p className="font-bold mb-1 text-slate-300 uppercase tracking-widest text-[9px]">Bearish Signal</p>
                              <p className="leading-relaxed">
                                Emiten sedang dalam fase bearish. Saat ini, {health.dropAgainCount} histori dividen ({(health.dropAgainCount / Math.max(1, filtered.filter(r => r.Status_Recovery === "Pulih").length) * 100).toFixed(0)}%) kembali jatuh di bawah harga modal (Drop Again).
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="relative shrink-0">
                        <div
                          className={`flex items-center gap-2 px-3 md:px-4 rounded-xl text-sm md:text-base font-black h-10 md:h-11 ${health.badgeClass}`}
                        >
                          <health.Icon className="w-5 h-5" />
                          {health.score}/10
                        </div>
                      </div>
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
              className="btn-secondary"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">
                {copied ? "Copied!" : "Copy Link"}
              </span>
            </button>
          </div>
        </div>

        {/* ── DYNAMIC SUBTLE SUMMARY ── */}
        <section className="animate-in fade-in slide-in-from-top-4 duration-700">
          <div className={`p-[1px] bg-gradient-to-r ${
            health.label === 'Safe' ? 'from-emerald-500 via-teal-400 to-emerald-600' :
            health.label === 'Caution' ? 'from-amber-500 via-orange-400 to-amber-600' :
            'from-rose-500 via-red-400 to-rose-600'
          } rounded-2xl shadow-sm`}>
            <div className="bg-white rounded-[15px] p-4 md:p-5 relative overflow-hidden">
              <div className={`absolute -top-10 -right-10 w-24 h-24 ${health.label === 'Safe' ? 'bg-emerald-50/40' : health.label === 'Caution' ? 'bg-amber-50/40' : 'bg-rose-50/40'} blur-[30px] rounded-full`} />
              
              <div className="relative flex items-center gap-2 mb-2">
                <Sparkles className={`w-3.5 h-3.5 ${health.label === 'Safe' ? 'text-emerald-500' : health.label === 'Caution' ? 'text-amber-500' : 'text-rose-500'}`} />
                <h2 className={`text-[9px] font-black ${health.label === 'Safe' ? 'text-emerald-600' : health.label === 'Caution' ? 'text-amber-600' : 'text-rose-600'} uppercase tracking-[0.2em]`}>Summary</h2>
              </div>
              <p className="relative text-xs md:text-sm text-slate-600 leading-relaxed font-medium">
                {health.reason}
                {health.isBearish && (
                  <span className="block mt-2 font-bold text-rose-600 flex items-center gap-1.5">
                    Waspada: Tren harga saat ini sedang dalam fase bearish.
                  </span>
                )}
              </p>
            </div>
          </div>
        </section>

        {/* ── SIMULATION CONTROL PANEL ── */}
        <section className="bg-white border border-slate-200/60 rounded-2xl relative z-20">
          <button
            onClick={() => isMobile && setIsPanelCollapsed(!isPanelCollapsed)}
            className={`w-full flex items-center justify-between p-4 md:p-6 text-left rounded-t-2xl transition-colors ${isMobile ? "cursor-pointer hover:bg-slate-50" : "cursor-default"}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Activity className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Simulasi Investasi</h2>
                {isMobile && isPanelCollapsed && engine && (
                  <p className="text-[10px] font-bold text-indigo-600 mt-0.5">
                    {fmt(amount)} • {investStyle === 'lumpsum' ? 'Sekali Beli' : 'Nabung Rutin'} • {divStrategy === 'compound' ? 'Putar Dividen' : 'Cairkan'}
                  </p>
                )}
              </div>
            </div>
            {isMobile && (
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isPanelCollapsed ? "" : "rotate-180"}`} />
            )}
          </button>

          <div className={`transition-all duration-300 ease-in-out ${isPanelCollapsed ? "max-h-0 opacity-0 overflow-hidden" : "max-h-[1000px] opacity-100 border-t border-slate-100 overflow-visible"}`}>
            <div className="p-4 md:p-6 pt-0 md:pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
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
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${investStyle === s.key
                          ? "bg-white text-indigo-600 ring-1 ring-slate-200/40"
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
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${divStrategy === s.key
                          ? "bg-white text-indigo-600 ring-1 ring-slate-200/40"
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
            </div>
          </div>
        </section>

        {engine && engine.isDivergent && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
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
                label="Recovery vs Drop"
                value={`${Math.round(engine.medianRecovery)}d / -${engine.meanDrop.toFixed(1)}%`}
                sub={`Median Recovery vs Avg Ex-date Drop`}
                positive={engine.medianRecovery <= 30 && engine.meanDrop < (engine.avgYield || 5)}
              />
            </div>

            {/* ── CHART ── */}
            <div id="chart" className="bg-white border border-slate-200/60 rounded-3xl p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-6">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Portfolio Performance</h2>
                  <p className="text-sm font-medium text-slate-500">Perbandingan nilai vs Deposito Bank (4% p.a)</p>
                </div>
                <div className="flex items-center justify-end gap-4 sm:gap-6">
                  <div className="flex items-center gap-4 md:gap-6">
                    <LegendDot color="bg-indigo-500" label="Portfolio" />
                    <LegendDot color="bg-slate-300" label="Deposito Bank" />
                  </div>
                  <button
                    onClick={() => setFullscreenChart('portfolio')}
                    className="btn-icon"
                    title="Maximize Chart"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={engine.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gPortfolio" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-indigo-600)" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="var(--color-indigo-600)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gDeposit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-slate-400)" stopOpacity={0.05} />
                        <stop offset="95%" stopColor="var(--color-slate-400)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-slate-100)" vertical={false} />
                    <XAxis
                      dataKey="Date"
                      tickFormatter={xAxisFormatter}
                      tick={{ fontSize: 10, fill: "var(--color-slate-500)", fontWeight: 600 }}
                      interval={isMobile ? 11 : 2}
                      axisLine={false}
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis
                      domain={['dataMin * 0.95', 'dataMax * 1.05']}
                      tick={{ fontSize: 11, fill: "var(--color-slate-500)", fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={yAxisPortfolioFormatter}
                      width={50}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--color-slate-200)', strokeWidth: 1.5, strokeDasharray: '4 4' }} />
                    <Area
                      type="monotone"
                      dataKey="Portfolio"
                      stroke="var(--color-indigo-600)"
                      strokeWidth={3.5}
                      fill="url(#gPortfolio)"
                      dot={renderDividendDot}
                      activeDot={{ r: 7, fill: "#10b981", stroke: "#fff", strokeWidth: 3 }}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="Deposito"
                      stroke="var(--color-slate-400)"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      fill="url(#gDeposit)"
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
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
                  <div className="flex items-center justify-end gap-4">
                    <div className="flex items-center gap-4">
                      <LegendDot color="bg-slate-400" label="Price (IDR)" />
                    </div>
                    <button
                      onClick={() => setFullscreenChart('price')}
                      className="btn-icon"
                      title="Maximize Chart"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredPrices} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-slate-200)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--color-slate-50)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-slate-100)" vertical={false} />
                      <XAxis
                        dataKey="Date"
                        tickFormatter={xAxisFormatter}
                        tick={{ fontSize: 10, fill: "var(--color-slate-500)", fontWeight: 600 }}
                        interval={isMobile ? 11 : 2}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis
                        domain={['dataMin * 0.98', 'dataMax * 1.02']}
                        tick={{ fontSize: 11, fill: "var(--color-slate-500)", fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={yAxisPriceFormatter}
                        width={60}
                      />
                      <Tooltip content={<CustomPriceTooltip />} cursor={{ stroke: 'var(--color-slate-300)', strokeWidth: 1.5 }} />
                      <Area
                        type="monotone"
                        dataKey="Price"
                        name="Market Price"
                        stroke="var(--color-slate-400)"
                        strokeWidth={2.5}
                        fill="url(#gPrice)"
                        activeDot={{ r: 6, fill: "#fff", stroke: "#94a3b8", strokeWidth: 2.5 }}
                        isAnimationActive={false}
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
                      {["Date", "Cum & Ex Price", "Dividend", "Drop", "Recovery", "Status"].map((h, i) => (
                        <th
                          key={h}
                          className={`px-4 md:px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest ${i >= 1 ? "text-right" : "text-left"} ${i === 5 ? "text-center" : ""}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {engine.yearly.map((row) => {
                      const drop = row.Ex_Price_1day ? ((row.Ex_Price_1day - row.Cum_Price) / row.Cum_Price) * 100 : null;
                      return (
                        <tr key={`${row.Ticker}-${row.Year}-${row.Cum_Date}`} className="group hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 md:px-8 py-5 text-slate-500 font-bold">{row.Cum_Date}</td>
                          <td className="px-4 md:px-8 py-5 text-right">
                            <div className="font-bold text-slate-900">{row.Cum_Price?.toLocaleString("id-ID")}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Ex-date: {row.Ex_Price_1day?.toLocaleString("id-ID") || "-"}</div>
                          </td>
                          <td className="px-4 md:px-8 py-5 text-right">
                            <div className="font-bold text-slate-900">Rp {row.Dividend?.toLocaleString("id-ID")}</div>
                            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-tight">Yield {row.divYield.toFixed(1)}%</div>
                          </td>
                          <td className={`px-4 md:px-8 py-5 text-right font-bold ${drop !== null && drop < -3 ? "text-rose-600" : "text-slate-500"}`}>
                            {drop !== null ? `${drop.toFixed(1)}%` : "-"}
                          </td>
                          <td className={`px-4 md:px-8 py-5 text-right font-extrabold ${row.hasRecoveredOnce ? (row.Recovery_Days > 40 ? "text-rose-600" : "text-emerald-500") : "text-slate-400"}`}>
                            {row.recoveryDisplay}
                          </td>
                          <td className="px-4 md:px-8 py-5 text-right">
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
                                    Harga saham tidak pernah kembali ke level Cum Date setelah lebih dari 60 hari (2 bulan). Dividen ini menjadi jebakan modal.
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
                                    Saham belum pulih ke level Cum Date, namun durasi saat ini masih di bawah 60 hari.
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
                  const drop = row.Ex_Price_1day ? ((row.Ex_Price_1day - row.Cum_Price) / row.Cum_Price) * 100 : null;
                  return (
                    <div key={`m-${row.Ticker}-${row.Year}-${row.Cum_Date}`} className="px-4 py-4 flex flex-col gap-6">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-tight">{row.Cum_Date}</span>
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
                                {`Harga saham tidak pernah kembali ke level Cum Date setelah lebih dari 60 hari (2 bulan). Dividen ini menjadi jebakan modal.`}
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
                                {`Saham belum pulih ke level Cum Date, namun durasi saat ini masih di bawah 60 hari.`}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-4 px-1">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Cum Price</span>
                          <span className="text-sm font-bold text-slate-900">Rp {row.Cum_Price?.toLocaleString("id-ID") || "-"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Dividend (Yield)</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-slate-900">{row.Dividend?.toLocaleString("id-ID")}</span>
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">{row.divYield.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Ex-date Drop</span>
                          <span className={`text-sm font-bold ${drop !== null && drop < -3 ? "text-rose-600" : "text-slate-900"}`}>
                            {drop !== null ? `${drop.toFixed(1)}%` : "-"}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Recovery</span>
                          <span className={`text-sm font-extrabold ${row.hasRecoveredOnce ? (row.Recovery_Days > 40 ? "text-rose-600" : "text-emerald-500") : "text-slate-900"}`}>{row.recoveryDisplay}</span>
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

      <InterpretationGuide />

      <footer className="border-t border-slate-100 py-12 text-center">
        <p className="text-slate-400 text-sm">© 2026 Dividown Portal. Data historis, bukan rekomendasi investasi.</p>
        {status && (
          <p className="text-slate-300 text-[10px] mt-2 font-medium uppercase tracking-widest">
            Data terakhir diperbarui: {status.last_updated}
          </p>
        )}
      </footer>

      {/* ── FULLSCREEN CHART OVERLAY ── */}
      {fullscreenChart && createPortal(
        <div className="fixed inset-0 z-[10000] bg-white flex flex-col animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {fullscreenChart === 'portfolio' ? 'Portfolio Performance' : 'Market Price History'} - {ticker}
              </h2>
              <p className="text-sm font-medium text-slate-500">
                {fullscreenChart === 'portfolio' ? 'Simulasi nilai total investasi' : 'Verifikasi harga pasar bulanan'}
              </p>
            </div>
            <button
              onClick={() => setFullscreenChart(null)}
              className="btn-icon text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100"
            >
              <Minimize2 className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 min-h-0 p-2 md:p-8">
            <ResponsiveContainer width="100%" height="100%">
              {fullscreenChart === 'portfolio' ? (
                <AreaChart data={engine.chartData} margin={{ top: 20, right: 10, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="gPortfolioFull" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-indigo-600)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--color-indigo-600)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-slate-100)" vertical={false} />
                  <XAxis
                    dataKey="Date"
                    tickFormatter={xAxisFormatter}
                    tick={{ fontSize: 10, fill: "var(--color-slate-500)", fontWeight: 600 }}
                    interval={isMobile ? 11 : 2}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis
                    domain={['dataMin * 0.95', 'dataMax * 1.05']}
                    tick={{ fontSize: 12, fill: "var(--color-slate-500)", fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={yAxisPortfolioFormatter}
                    width={60}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="Portfolio"
                    stroke="var(--color-indigo-600)"
                    strokeWidth={4}
                    fill="url(#gPortfolioFull)"
                    dot={renderDividendDotFull}
                    activeDot={{ r: 8, fill: "#10b981", stroke: "#fff", strokeWidth: 3 }}
                    isAnimationActive={false}
                  />
                  <Area type="monotone" dataKey="Deposito" stroke="var(--color-slate-400)" strokeWidth={2} strokeDasharray="6 4" fill="transparent" dot={false} isAnimationActive={false} />
                </AreaChart>
              ) : (
                <AreaChart data={filteredPrices} margin={{ top: 20, right: 10, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="gPriceFull" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-slate-200)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-slate-50)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-slate-100)" vertical={false} />
                  <XAxis
                    dataKey="Date"
                    tickFormatter={xAxisFormatter}
                    tick={{ fontSize: 10, fill: "var(--color-slate-500)", fontWeight: 600 }}
                    interval={isMobile ? 11 : 2}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis
                    domain={['dataMin * 0.98', 'dataMax * 1.02']}
                    tick={{ fontSize: 12, fill: "var(--color-slate-500)", fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={yAxisPriceFormatter}
                    width={70}
                  />
                  <Tooltip content={<CustomPriceTooltip />} />
                  <Area type="monotone" dataKey="Price" stroke="var(--color-slate-400)" strokeWidth={3} fill="url(#gPriceFull)" activeDot={{ r: 8, fill: "#fff", stroke: "#94a3b8", strokeWidth: 3 }} isAnimationActive={false} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center gap-8">
            {fullscreenChart === 'portfolio' ? (
              <>
                <LegendDot color="bg-indigo-500" label="Portfolio Value" />
                <LegendDot color="bg-slate-400" label="Bank Deposit (4%)" />
              </>
            ) : (
              <LegendDot color="bg-slate-400" label="Market Price (IDR)" />
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Scroll to Top - Subtle White */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-6 right-6 z-50 p-3 rounded-full bg-white shadow-lg border border-slate-100 text-slate-400 hover:text-indigo-600 transition-all duration-300 transform md:hidden ${showScrollTop ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"}`}
        aria-label="Scroll to top"
      >
        <ArrowUp className="w-5 h-5" />
      </button>

      <Analytics />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, sub, positive }) {
  return (
    <div className="bg-white border border-slate-200/60 rounded-2xl p-4 md:p-5 hover-lift group">
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
    <div className="bg-white border border-slate-200/60 rounded-3xl p-4 md:p-5 flex items-center gap-4 hover-lift">
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

function InterpretationGuide() {
  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 pb-20 pt-12 border-t border-slate-200/60 mt-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Metrik Utama</h4>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-1">Total Return</p>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Gabungan Capital Gain (kenaikan harga) dan Dividen Bersih. Strategi "Cairkan" memotong pajak 10% sesuai regulasi Indonesia, sedangkan "Putar Kembali" menginvestasikan dividen kotor untuk efek bunga majemuk.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-1">Divergence Warning</p>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Muncul jika Portfolio tumbuh positif tapi harga saham dasar turun. Ini menandakan keuntungan Anda hanya berasal dari akumulasi dividen, bukan pertumbuhan aset dasar.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Tabel Histori</h4>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-1">Drop % (Ex-Date)</p>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Penurunan harga dari Cum Date ke penutupan hari bursa berikutnya (Ex-Date + 1). Angka merah menandakan penurunan tajam yang sering memicu psikologi "Dividend Trap".
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-1">Recovery Duration</p>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Jumlah hari kalender hingga harga penutupan kembali menyentuh modal Anda (Cum Price). Label <span className="font-bold">"XXd++"</span> berarti harga belum pernah kembali sejak tanggal tersebut.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Status Indikator</h4>
          <div className="space-y-2">
            <div className="flex gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0"></span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                <span className="font-bold text-slate-500">RECOVERED:</span> Harga sudah pernah menyentuh modal dan saat ini masih di atas 95% modal awal.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 shrink-0"></span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                <span className="font-bold text-slate-500">DROP AGAIN:</span> Harga pernah pulih, namun saat ini turun kembali di bawah 95% modal awal Anda.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1 shrink-0"></span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                <span className="font-bold text-slate-500">DIVIDEND TRAP:</span> Harga belum pulih setelah lebih dari 60 hari (2 bulan) sejak pembagian dividen.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-5 bg-slate-100/50 rounded-2xl border border-slate-200/40">
          <h4 className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Disclaimer Hukum</h4>
          <p className="text-[9px] text-slate-400 leading-relaxed italic">
            Simulasi ini menggunakan data historis Yahoo Finance yang mungkin memiliki delay. Performa masa lalu bukan jaminan hasil masa depan. Dividown adalah alat bantu edukasi, bukan penasihat investasi berlisensi. Semua keputusan investasi dan risiko kerugian sepenuhnya merupakan tanggung jawab pribadi pengguna.
          </p>
        </div>
      </div>


    </section>
  );
}
