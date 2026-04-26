import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, Banknote, Clock, Wallet, BarChart3,
  Activity, CheckCircle2, XCircle, ChevronDown
} from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
import { calculateHealthScore } from "./utils/healthScore";

// ── Constants ──────────────────────────────────────────────────────────────
const DEPOSIT_RATE = 0.04;
const EST_YIELD = 0.05;
const LATEST_PRICES = { BBRI: 4410, BMRI: 5600, BBCA: 9800, BBNI: 4850 };

// ── Formatters ─────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

const pct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

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

  // New simulation inputs
  const [startYear, setStartYear] = useState(2021);
  const [investStyle, setInvestStyle] = useState("lumpsum"); // "lumpsum" | "dca"
  const [amount, setAmount] = useState(10000000);
  const [divStrategy, setDivStrategy] = useState("compound"); // "compound" | "passive"
  const [loading, setLoading] = useState(true);

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
    () => data.filter((d) => d.Ticker === ticker && d.Year >= startYear).sort((a, b) => a.Year - b.Year),
    [data, ticker, startYear]
  );

  const filteredPrices = useMemo(
    () => priceData
      .filter((p) => p.Ticker === ticker)
      .map((p) => ({
        ...p,
        displayDate: new Date(p.Date).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
      })),
    [priceData, ticker]
  );

  const latestPrice = useMemo(() => {
    const prices = priceData.filter(p => p.Ticker === ticker);
    if (prices.length) return prices[prices.length - 1].Price;
    return LATEST_PRICES[ticker] ?? 5000;
  }, [priceData, ticker]);

  // ── Calculation Engine (Lumpsum + DCA) ────────────────────────────────────
  const engine = useMemo(() => {
    if (!filtered.length) return null;

    let currentShares = 0;
    let totalDiv = 0;
    let totalInvested = 0;
    let leftover = 0;

    // Get monthly prices for this ticker filtered by startYear
    const monthlyForTicker = priceData
      .filter(p => p.Ticker === ticker && new Date(p.Date).getFullYear() >= startYear)
      .sort((a, b) => new Date(a.Date) - new Date(b.Date));

    if (investStyle === "lumpsum") {
      // Buy all shares at the first available cum price
      const cumPrice0 = filtered[0].Cum_Price;
      currentShares = Math.floor(amount / cumPrice0);
      leftover = amount - currentShares * cumPrice0;
      totalInvested = amount;
    } else {
      // DCA: buy shares each month using monthly prices
      const monthlyAmount = amount;
      let dcaLeftover = 0;
      for (const mp of monthlyForTicker) {
        const mpYear = new Date(mp.Date).getFullYear();
        // Only DCA up to the last dividend year in data
        if (mpYear > filtered[filtered.length - 1].Year) break;
        const available = monthlyAmount + dcaLeftover;
        const newShares = Math.floor(available / mp.Price);
        dcaLeftover = available - newShares * mp.Price;
        currentShares += newShares;
        totalInvested += monthlyAmount;
      }
      leftover = dcaLeftover;
    }

    const yearly = filtered.map((row) => {
      const divPerShare = Math.round(row.Cum_Price * EST_YIELD);
      const divPayout = currentShares * divPerShare;
      totalDiv += divPayout;
      if (divStrategy === "compound") {
        currentShares += Math.floor(divPayout / row.Cum_Price);
      }
      return { ...row, divPerShare, divPayout, sharesAfter: currentShares, totalDivSoFar: totalDiv };
    });

    const portfolioValue =
      currentShares * latestPrice + (divStrategy === "passive" ? totalDiv : 0) + leftover;
    const years = filtered.length;
    const depositValue = totalInvested * Math.pow(1 + DEPOSIT_RATE, years);
    const totalReturn = totalInvested > 0 ? ((portfolioValue - totalInvested) / totalInvested) * 100 : 0;
    const netProfit = portfolioValue - totalInvested;
    const avgRecovery = filtered.reduce((s, r) => s + (r.Recovery_Days || 0), 0) / filtered.length;
    const notRecovered = filtered.filter((r) => r.Status_Recovery.includes("Belum") || r.Status_Recovery.includes("Trap")).length;

    const chartData = yearly.map((r, i) => ({
      id: i,
      year: r.Year,
      dividendType: r.dividendType,
      Portfolio: Math.round(
        r.sharesAfter * r.Cum_Price + (divStrategy === "passive" ? r.totalDivSoFar : 0) + leftover
      ),
      Deposito: Math.round(totalInvested * Math.pow(1 + DEPOSIT_RATE, i + 1)),
    }));

    return {
      shares: investStyle === "lumpsum" ? Math.floor(amount / filtered[0].Cum_Price) : currentShares,
      currentShares, totalDiv, portfolioValue, depositValue, totalInvested,
      totalReturn, netProfit, avgRecovery, notRecovered, yearly, chartData, years,
    };
  }, [filtered, amount, investStyle, divStrategy, latestPrice, priceData, ticker, startYear]);

  const health = useMemo(() => calculateHealthScore(filtered), [filtered]);

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
      <main className="max-w-6xl mx-auto px-6 py-12 space-y-4">

        {/* ── HEADER ── */}
        <div className="flex flex-col gap-6">
          <button 
            onClick={() => navigate('/')} 
            className="group inline-flex items-center gap-2 text-sm font-bold text-indigo-600 transition-colors cursor-pointer w-fit"
          >
            <div className="p-1.5 rounded-full bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            Back to Discovery
          </button>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">{ticker}</h1>
                {health && (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ring-1 ${health.badgeClass}`}>
                    <health.Icon className="w-3.5 h-3.5" />
                    {health.label}
                  </div>
                )}
              </div>
              <p className="text-lg text-slate-500 max-w-2xl font-medium">
                Historical performance & recovery simulation vs 4% p.a. deposit.
              </p>
            </div>
          </div>
        </div>

        {/* ── SIMULATION CONTROL PANEL ── */}
        <section className="bg-white border border-slate-200/60 rounded-2xl p-6">
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
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      investStyle === s.key
                      ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/40"
                      : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Tahun Mulai */}
            <div className="space-y-3">
              <label htmlFor="start-year" className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Tahun Mulai
              </label>
              <div className="relative">
                <select
                  id="start-year"
                  value={startYear}
                  onChange={(e) => setStartYear(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200/60 rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-900 hover:border-indigo-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer appearance-none pr-10"
                >
                  {[2021, 2022, 2023, 2024, 2025].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* 4. Strategi Dividen */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Strategi Dividen
              </label>
              <div className="flex rounded-2xl border border-slate-200/60 overflow-hidden bg-slate-50 p-1">
                {[{ key: "compound", label: "Putar Kembali" }, { key: "passive", label: "Cairkan" }].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setDivStrategy(s.key)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      divStrategy === s.key
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
        </section>

        {engine && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* ── METRIC CARDS ── */}
            <div id="metrics" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard
                icon={TrendingUp}
                label="Total Return"
                value={pct(engine.totalReturn)}
                sub={`Deposit baseline ${pct(((engine.depositValue - engine.totalInvested) / engine.totalInvested) * 100)}`}
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
            <div id="chart" className="bg-white border border-slate-200/60 rounded-3xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-6">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Portfolio Performance</h2>
                  <p className="text-sm font-medium text-slate-500">Value comparison vs Bank Deposit</p>
                </div>
                <div className="flex items-center gap-6 bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100">
                  <LegendDot color="bg-indigo-500" label="Portfolio" />
                  <LegendDot color="bg-slate-300" label="Deposit" />
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
              <div id="price-chart" className="bg-white border border-slate-200/60 rounded-3xl p-6">
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
                        tickFormatter={(val) => new Date(val).getFullYear()}
                        tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }} 
                        axisLine={false} 
                        tickLine={false}
                        minTickGap={40}
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MiniStat icon={BarChart3} label="Owned Shares" value={engine.currentShares.toLocaleString("id-ID")} />
              <MiniStat icon={Banknote} label="Total Dividends" value={fmt(engine.totalDiv)} />
              <MiniStat icon={Wallet} label="Portfolio Value" value={fmt(engine.portfolioValue)} />
              <MiniStat icon={Activity} label="Deposit Value" value={fmt(engine.depositValue)} />
            </div>

            {/* ── HISTORY TABLE ── */}
            <section id="history" className="bg-white border border-slate-200/60 rounded-3xl overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
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
                          className={`px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest ${i >= 2 ? "text-right" : "text-left"} ${i === 6 ? "text-center" : ""}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((row) => {
                      const drop = ((row.Ex_Price_1day - row.Cum_Price) / row.Cum_Price) * 100;
                      const recovered = row.Status_Recovery.includes("Sudah");
                      return (
                        <tr key={`${row.Ticker}-${row.Year}`} className="group hover:bg-slate-50/80 transition-colors">
                          <td className="px-8 py-5 font-bold text-slate-900">{row.Year}</td>
                          <td className="px-8 py-5 text-slate-500 font-semibold">{row.Cum_Date}</td>
                          <td className="px-8 py-5 text-right text-slate-700 font-bold">{row.Cum_Price.toLocaleString("id-ID")}</td>
                          <td className="px-8 py-5 text-right text-slate-700 font-bold">{row.Ex_Price_1day.toLocaleString("id-ID")}</td>
                          <td className={`px-8 py-5 text-right font-bold ${drop < -3 ? "text-rose-600" : "text-slate-500"}`}>
                            {drop.toFixed(1)}%
                          </td>
                          <td className={`px-8 py-5 text-right font-extrabold ${row.Recovery_Days > 40 ? "text-rose-600" : row.Recovery_Days > 20 ? "text-amber-500" : "text-emerald-500"}`}>
                            {row.Recovery_Days}d
                          </td>
                          <td className="px-8 py-5 text-center">
                            {recovered ? (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50">
                                <CheckCircle2 className="w-3.5 h-3.5" /> PULIH
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-200/50">
                                <XCircle className="w-3.5 h-3.5" /> TRAP
                              </span>
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
                {filtered.map((row) => {
                  const drop = ((row.Ex_Price_1day - row.Cum_Price) / row.Cum_Price) * 100;
                  const recovered = row.Status_Recovery.includes("Sudah");
                  return (
                    <div key={`m-${row.Ticker}-${row.Year}`} className="px-6 py-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xl">{row.Year}</span>
                        {recovered ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50">
                            <CheckCircle2 className="w-3.5 h-3.5" /> PULIH
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-200/50">
                            <XCircle className="w-3.5 h-3.5" /> TRAP
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cum</p>
                          <p className="font-bold text-slate-900">{row.Cum_Price.toLocaleString("id-ID")}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Drop</p>
                          <p className={`font-bold ${drop < -3 ? "text-rose-600" : "text-slate-900"}`}>{drop.toFixed(1)}%</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rec</p>
                          <p className={`font-bold ${row.Recovery_Days > 40 ? "text-rose-600" : "text-emerald-500"}`}>{row.Recovery_Days}d</p>
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
    <div className="bg-white border border-slate-200/60 rounded-2xl p-5 transition-all hover:-translate-y-1 group">
      <div className="flex items-center justify-between mb-5">
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
    <div className="bg-white border border-slate-200/60 rounded-3xl p-5 flex items-center gap-4 transition-all">
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
