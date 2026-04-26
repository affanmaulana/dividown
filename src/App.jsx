import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, ShieldCheck, ShieldAlert,
  AlertTriangle, Banknote, Clock, Wallet, BarChart3,
  Activity, CheckCircle2, XCircle, ChevronDown,
  Shield, TriangleAlert, OctagonAlert,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────
const TICKERS = ["BBRI", "BMRI", "BBNI", "BBCA"];
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
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700 mb-2">Tahun {label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-medium text-slate-800">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState([]);
  const [ticker, setTicker] = useState("BBRI");
  const [capital, setCapital] = useState(10000000);
  const [strategy, setStrategy] = useState("reinvest");
  const [loading, setLoading] = useState(true);
  const [tickerOpen, setTickerOpen] = useState(false);

  useEffect(() => {
    fetch("/data/dividend_recovery.json")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!tickerOpen) return;
    const handler = () => setTickerOpen(false);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [tickerOpen]);

  const filtered = useMemo(
    () => data.filter((d) => d.Ticker === ticker).sort((a, b) => a.Year - b.Year),
    [data, ticker]
  );

  const latestPrice = LATEST_PRICES[ticker] ?? 5000;

  // ── Calculation Engine ────────────────────────────────────────────────────
  const engine = useMemo(() => {
    if (!filtered.length) return null;
    const cumPrice0 = filtered[0].Cum_Price;
    const shares = Math.floor(capital / cumPrice0);
    const leftover = capital - shares * cumPrice0;
    let totalDiv = 0;
    let currentShares = shares;

    const yearly = filtered.map((row) => {
      const divPerShare = Math.round(row.Cum_Price * EST_YIELD);
      const divPayout = currentShares * divPerShare;
      totalDiv += divPayout;
      if (strategy === "reinvest") {
        currentShares += Math.floor(divPayout / row.Cum_Price);
      }
      return { ...row, divPerShare, divPayout, sharesAfter: currentShares, totalDivSoFar: totalDiv };
    });

    const portfolioValue =
      currentShares * latestPrice + (strategy === "cash" ? totalDiv : 0) + leftover;
    const years = filtered.length;
    const depositValue = capital * Math.pow(1 + DEPOSIT_RATE, years);
    const totalReturn = ((portfolioValue - capital) / capital) * 100;
    const netProfit = portfolioValue - capital;
    const avgRecovery = filtered.reduce((s, r) => s + r.Recovery_Days, 0) / filtered.length;
    const notRecovered = filtered.filter((r) => r.Status_Recovery.includes("Belum")).length;

    const chartData = yearly.map((r, i) => ({
      year: r.Year,
      Portfolio: Math.round(
        r.sharesAfter * r.Cum_Price + (strategy === "cash" ? r.totalDivSoFar : 0) + leftover
      ),
      Deposito: Math.round(capital * Math.pow(1 + DEPOSIT_RATE, i + 1)),
    }));

    return {
      shares, currentShares, totalDiv, portfolioValue, depositValue,
      totalReturn, netProfit, avgRecovery, notRecovered, yearly, chartData, years,
    };
  }, [filtered, capital, strategy, latestPrice]);

  // ── Health Score (0-100) ──────────────────────────────────────────────────
  const healthScore = useMemo(() => {
    if (!filtered.length) return null;

    let score = 0;
    const breakdown = [];

    // (+40) Avg Recovery Days < 30
    const avgRecDays = filtered.reduce((s, r) => s + r.Recovery_Days, 0) / filtered.length;
    const recoveryPassed = avgRecDays < 30;
    if (recoveryPassed) score += 40;
    breakdown.push({ label: "Recovery < 30d", value: `${Math.round(avgRecDays)}d avg`, passed: recoveryPassed, points: 40 });

    // (+30) 100% status "Pulih"
    const totalEvents = filtered.length;
    const pulihCount = filtered.filter((r) => r.Status_Recovery.includes("Sudah")).length;
    const allPulih = pulihCount === totalEvents;
    if (allPulih) score += 30;
    breakdown.push({ label: "100% Pulih", value: `${pulihCount}/${totalEvents}`, passed: allPulih, points: 30 });

    // (+30) Avg Drop saat Ex-date < 5%
    const avgDrop = filtered.reduce((s, r) => {
      const drop = Math.abs(((r.Ex_Price_1day - r.Cum_Price) / r.Cum_Price) * 100);
      return s + drop;
    }, 0) / filtered.length;
    const dropPassed = avgDrop < 5;
    if (dropPassed) score += 30;
    breakdown.push({ label: "Drop < 5%", value: `${avgDrop.toFixed(2)}% avg`, passed: dropPassed, points: 30 });

    // Label & tier
    let label, tier, Icon;
    if (score >= 80) {
      label = "Low Risk"; tier = "low"; Icon = Shield;
    } else if (score >= 50) {
      label = "Medium Risk"; tier = "medium"; Icon = TriangleAlert;
    } else {
      label = "High Risk / Trap"; tier = "high"; Icon = OctagonAlert;
    }

    return { score, label, tier, Icon, breakdown };
  }, [filtered]);

  // Badge styling based on tier
  const healthBadge = healthScore ? {
    low: { badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", accent: "#10b981", bg: "bg-emerald-500", bgLight: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-100" },
    medium: { badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", accent: "#f59e0b", bg: "bg-amber-500", bgLight: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-100" },
    high: { badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200", accent: "#ef4444", bg: "bg-rose-500", bgLight: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-100" },
  }[healthScore.tier] : { badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-200", accent: "#94a3b8", bg: "bg-slate-400", bgLight: "bg-slate-50", text: "text-slate-600", ring: "ring-slate-100" };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 tracking-wide">Memuat data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 tracking-tight">Dividown</span>
              <span className="hidden sm:inline text-xs text-slate-400 ml-2 font-normal">Dividend Trap Detector</span>
            </div>
          </div>
          {healthScore && (
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${healthBadge.badge}`}>
              <healthScore.Icon className="w-3.5 h-3.5" />
              {ticker} · {healthScore.label}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── PAGE TITLE + HEALTH SCORE CARD ── */}
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-5">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analisis Dividen Saham Bank</h1>
            <p className="text-sm text-slate-500 mt-1">
              Simulasi return portofolio vs deposito 4% p.a. untuk saham BBRI, BMRI, BBNI, dan BBCA.
            </p>
          </div>

          {/* ── HEALTH SCORE HIGHLIGHT CARD ── */}
          {healthScore && (
            <div id="health-score-card" className={`relative overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-sm p-5 lg:p-6 lg:min-w-[340px] ring-1 ${healthBadge.ring}`}>
              {/* Decorative accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${healthBadge.bg}`} />

              <div className="flex items-start gap-4">
                {/* Score Circle */}
                <div className="relative shrink-0">
                  <svg width="72" height="72" viewBox="0 0 72 72">
                    <circle cx="36" cy="36" r="30" fill="none" stroke="#f1f5f9" strokeWidth="6" />
                    <circle
                      cx="36" cy="36" r="30" fill="none"
                      stroke={healthBadge.accent}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${(healthScore.score / 100) * 188.5} 188.5`}
                      transform="rotate(-90 36 36)"
                      style={{ transition: "stroke-dasharray 0.8s ease" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-slate-800">{healthScore.score}</span>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-slate-900 tracking-tight">Health Score · {ticker}</span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${healthBadge.badge}`}>
                      <healthScore.Icon className="w-3 h-3" />
                      {healthScore.label}
                    </span>
                  </div>

                  {/* Breakdown */}
                  <div className="space-y-1.5">
                    {healthScore.breakdown.map((b) => (
                      <div key={b.label} className="flex items-center gap-2 text-xs">
                        {b.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        <span className="text-slate-600">{b.label}</span>
                        <span className="text-slate-400 ml-auto tabular-nums">{b.value}</span>
                        <span className={`font-semibold tabular-nums ${b.passed ? "text-emerald-600" : "text-slate-300"}`}>+{b.points}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── CONTROL PANEL ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">

          {/* Ticker */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <label htmlFor="ticker-select" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Ticker Saham
            </label>
            <button
              id="ticker-select"
              onClick={() => setTickerOpen(!tickerOpen)}
              className="w-full flex items-center justify-between bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-800 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 transition-colors"
            >
              {ticker}
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${tickerOpen ? "rotate-180" : ""}`} />
            </button>
            {tickerOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-30 overflow-hidden">
                {TICKERS.map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTicker(t); setTickerOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      t === ticker
                        ? "bg-emerald-50 text-emerald-700 font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Capital */}
          <div>
            <label htmlFor="capital-input" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Modal Awal (IDR)
            </label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="capital-input"
                type="number"
                value={capital}
                onChange={(e) => setCapital(Number(e.target.value) || 0)}
                className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 transition-colors"
              />
            </div>
          </div>

          {/* Strategy */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Strategi Dividen
            </label>
            <div className="flex rounded-lg border border-slate-300 overflow-hidden text-sm font-medium">
              {[{ key: "reinvest", label: "Reinvest" }, { key: "cash", label: "Tunai" }].map((s) => (
                <button
                  key={s.key}
                  id={`strategy-${s.key}`}
                  onClick={() => setStrategy(s.key)}
                  className={`flex-1 py-2.5 transition-colors ${
                    strategy === s.key
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {engine && (
          <>
            {/* ── METRIC CARDS ── */}
            <div id="metrics" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard
                icon={TrendingUp}
                label="Total Return"
                value={pct(engine.totalReturn)}
                sub={`Deposito ${pct(((engine.depositValue - capital) / capital) * 100)}`}
                positive={engine.totalReturn >= 0}
              />
              <MetricCard
                icon={Banknote}
                label="Net Profit"
                value={fmt(engine.netProfit)}
                sub={`dari modal ${fmt(capital)}`}
                positive={engine.netProfit >= 0}
              />
              <MetricCard
                icon={Clock}
                label="Avg Recovery"
                value={`${Math.round(engine.avgRecovery)} hari`}
                sub={`${engine.notRecovered} event belum pulih`}
                positive={engine.avgRecovery <= 30}
              />
            </div>

            {/* ── CHART ── */}
            <div id="chart" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Performa Portfolio</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Portfolio Value vs Deposito Baseline (4% p.a.)</p>
                </div>
                <div className="flex items-center gap-4">
                  <LegendDot color="bg-emerald-500" label="Portfolio" />
                  <LegendDot color="bg-slate-300" label="Deposito" />
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={engine.chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gPortfolio" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gDeposit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${(v / 1e6).toFixed(0)}jt`}
                    width={45}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="Portfolio"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#gPortfolio)"
                    dot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Deposito"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    fill="url(#gDeposit)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* ── SUMMARY ROW ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MiniStat icon={BarChart3} label="Lembar Saham" value={engine.currentShares.toLocaleString("id-ID")} />
              <MiniStat icon={Banknote} label="Total Dividen" value={fmt(engine.totalDiv)} />
              <MiniStat icon={Wallet} label="Nilai Portfolio" value={fmt(engine.portfolioValue)} />
              <MiniStat icon={Activity} label="Nilai Deposito" value={fmt(engine.depositValue)} />
            </div>

            {/* ── HISTORY TABLE ── */}
            <div id="history" className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Riwayat Dividen · {ticker}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{filtered.length} event historis tercatat</p>
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {["Tahun", "Cum Date", "Cum Price", "Ex Price", "Drop", "Recovery", "Status"].map((h, i) => (
                        <th
                          key={h}
                          className={`px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i >= 2 ? "text-right" : "text-left"} ${i === 6 ? "text-center" : ""}`}
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
                        <tr key={`${row.Ticker}-${row.Year}`} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3.5 font-semibold text-slate-800">{row.Year}</td>
                          <td className="px-5 py-3.5 text-slate-500">{row.Cum_Date}</td>
                          <td className="px-5 py-3.5 text-right text-slate-700">{row.Cum_Price.toLocaleString("id-ID")}</td>
                          <td className="px-5 py-3.5 text-right text-slate-700">{row.Ex_Price_1day.toLocaleString("id-ID")}</td>
                          <td className={`px-5 py-3.5 text-right font-semibold ${drop < -3 ? "text-rose-600" : "text-amber-600"}`}>
                            {drop.toFixed(1)}%
                          </td>
                          <td className={`px-5 py-3.5 text-right font-medium ${row.Recovery_Days > 40 ? "text-rose-600" : row.Recovery_Days > 20 ? "text-amber-600" : "text-emerald-600"}`}>
                            {row.Recovery_Days}d
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            {recovered ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> Pulih
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                                <XCircle className="w-3 h-3" /> Belum
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
              <div className="sm:hidden divide-y divide-slate-100">
                {filtered.map((row) => {
                  const drop = ((row.Ex_Price_1day - row.Cum_Price) / row.Cum_Price) * 100;
                  const recovered = row.Status_Recovery.includes("Sudah");
                  return (
                    <div key={`m-${row.Ticker}-${row.Year}`} className="px-4 py-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{row.Year}</span>
                        {recovered ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Pulih
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                            <XCircle className="w-3 h-3" /> Belum
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-slate-400 mb-0.5">Cum Price</p>
                          <p className="font-medium text-slate-700">{row.Cum_Price.toLocaleString("id-ID")}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-0.5">Drop</p>
                          <p className={`font-semibold ${drop < -3 ? "text-rose-600" : "text-amber-600"}`}>{drop.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-0.5">Recovery</p>
                          <p className={`font-semibold ${row.Recovery_Days > 40 ? "text-rose-600" : "text-emerald-600"}`}>{row.Recovery_Days}d</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── FOOTER ── */}
        <footer className="text-center py-8 border-t border-slate-200">
          <p className="text-xs text-slate-400">Dividown · Data historis. Bukan rekomendasi investasi.</p>
        </footer>
      </main>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, sub, positive }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${positive ? "bg-emerald-50" : "bg-rose-50"}`}>
          <Icon className={`w-4 h-4 ${positive ? "text-emerald-600" : "text-rose-600"}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold tracking-tight ${positive ? "text-emerald-600" : "text-rose-600"}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1.5">{sub}</p>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-slate-500" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-slate-800 truncate mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}