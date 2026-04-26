import { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, ShieldCheck, ShieldAlert,
  CalendarDays, Banknote, Activity, ChevronDown, Search,
  AlertTriangle, CheckCircle2, XCircle, Wallet, BarChart3,
  Clock, ArrowUpRight, ArrowDownRight, Sparkles,
} from "lucide-react";

// ── constants ──
const TICKERS = ["BBRI", "BMRI", "BBNI", "BBCA"];
const DEPOSIT_RATE = 0.04;
const EST_YIELD = 0.05;
const LATEST_PRICES = { BBRI: 4410, BMRI: 5600, BBCA: 9800, BBNI: 4850 };

const fmt = (n) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const pct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

// ── App ──
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

  const filtered = useMemo(() => data.filter((d) => d.Ticker === ticker).sort((a, b) => a.Year - b.Year), [data, ticker]);
  const latestPrice = LATEST_PRICES[ticker] || 5000;

  // ── calculation engine ──
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
        const extra = Math.floor(divPayout / row.Cum_Price);
        currentShares += extra;
      }
      return { ...row, divPerShare, divPayout, sharesAfter: currentShares, totalDivSoFar: totalDiv };
    });

    const portfolioValue = currentShares * latestPrice + (strategy === "cash" ? totalDiv : 0) + leftover;
    const years = filtered.length;
    const depositValue = capital * Math.pow(1 + DEPOSIT_RATE, years);
    const totalReturn = ((portfolioValue - capital) / capital) * 100;
    const netProfit = portfolioValue - capital;
    const avgRecovery = filtered.reduce((s, r) => s + r.Recovery_Days, 0) / filtered.length;
    const notRecovered = filtered.filter((r) => r.Status_Recovery.includes("Belum")).length;

    const chartData = yearly.map((r, i) => {
      const yr = r.Year;
      const dep = capital * Math.pow(1 + DEPOSIT_RATE, i + 1);
      const port = r.sharesAfter * r.Cum_Price + (strategy === "cash" ? r.totalDivSoFar : 0) + leftover;
      return { year: yr, Portfolio: Math.round(port), Deposito: Math.round(dep) };
    });

    return { shares, currentShares, totalDiv, portfolioValue, depositValue, totalReturn, netProfit, avgRecovery, notRecovered, yearly, chartData, years };
  }, [filtered, capital, strategy, latestPrice]);

  const healthScore = useMemo(() => {
    if (!engine) return { label: "—", color: "slate", icon: ShieldCheck };
    if (engine.avgRecovery <= 20 && engine.notRecovered === 0) return { label: "Sehat", color: "emerald", icon: ShieldCheck };
    if (engine.avgRecovery <= 40) return { label: "Waspada", color: "amber", icon: AlertTriangle };
    return { label: "Bahaya", color: "rose", icon: ShieldAlert };
  }, [engine]);

  const healthColors = { emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" }, amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" }, rose: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" }, slate: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" } };
  const hc = healthColors[healthScore.color];
  const HealthIcon = healthScore.icon;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm tracking-widest uppercase">Loading data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <TrendingDown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-100 tracking-tight">Dividown</h1>
              <p className="text-[11px] text-slate-500 tracking-wider uppercase">Dividend Trap Detector</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${hc.border} ${hc.bg}`}>
            <HealthIcon className={`w-4 h-4 ${hc.text}`} />
            <span className={`text-xs font-medium ${hc.text}`}>{ticker} · {healthScore.label}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── CONTROL PANEL ── */}
        <section id="controls" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Ticker */}
          <div className="relative">
            <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-2 font-medium">Ticker Saham</label>
            <button id="ticker-select" onClick={() => setTickerOpen(!tickerOpen)} className="w-full flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 hover:border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
              <span className="font-medium">{ticker}</span>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${tickerOpen ? "rotate-180" : ""}`} />
            </button>
            {tickerOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl shadow-black/50 z-30">
                {TICKERS.map((t) => (
                  <button key={t} onClick={() => { setTicker(t); setTickerOpen(false); }} className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${t === ticker ? "bg-emerald-500/10 text-emerald-400" : "text-slate-300 hover:bg-slate-800"}`}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Capital */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-2 font-medium">Modal Awal (IDR)</label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
              <input id="capital-input" type="number" value={capital} onChange={(e) => setCapital(Number(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 hover:border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
          </div>
          {/* Strategy */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-2 font-medium">Strategi Dividen</label>
            <div className="flex rounded-xl border border-slate-800 overflow-hidden">
              {[{ key: "reinvest", label: "Reinvest" }, { key: "cash", label: "Cash" }].map((s) => (
                <button key={s.key} id={`strategy-${s.key}`} onClick={() => setStrategy(s.key)} className={`flex-1 py-3 text-sm font-medium transition-all ${strategy === s.key ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-slate-900 text-slate-500 hover:text-slate-300"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {engine && (
          <>
            {/* ── METRIC CARDS ── */}
            <section id="metrics" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard icon={TrendingUp} label="Total Return" value={pct(engine.totalReturn)} sub={`vs Deposito ${pct(((engine.depositValue - capital) / capital) * 100)}`} positive={engine.totalReturn >= 0} />
              <MetricCard icon={Banknote} label="Net Profit" value={fmt(engine.netProfit)} sub={`dari modal ${fmt(capital)}`} positive={engine.netProfit >= 0} />
              <MetricCard icon={Clock} label="Avg Recovery" value={`${Math.round(engine.avgRecovery)} hari`} sub={`${engine.notRecovered} event belum pulih`} positive={engine.avgRecovery <= 30} />
            </section>

            {/* ── CHART ── */}
            <section id="chart" className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">Performa Portfolio</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Portfolio Value vs Deposito Baseline (4% p.a.)</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Portfolio</span>
                  <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-2.5 h-2.5 rounded-full bg-slate-600" />Deposito</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={engine.chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gPortfolio" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gDeposit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64748b" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="year" stroke="#475569" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#475569" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}jt`} width={50} />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", fontSize: "12px", color: "#cbd5e1" }} formatter={(v) => [fmt(v), ""]} labelFormatter={(l) => `Tahun ${l}`} />
                  <Area type="monotone" dataKey="Portfolio" stroke="#10b981" strokeWidth={2.5} fill="url(#gPortfolio)" dot={{ r: 4, fill: "#10b981", strokeWidth: 0 }} activeDot={{ r: 6, fill: "#10b981", stroke: "#020617", strokeWidth: 3 }} />
                  <Area type="monotone" dataKey="Deposito" stroke="#475569" strokeWidth={1.5} strokeDasharray="6 4" fill="url(#gDeposit)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </section>

            {/* ── SUMMARY ROW ── */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MiniStat label="Lembar Saham" value={engine.currentShares.toLocaleString("id-ID")} icon={BarChart3} />
              <MiniStat label="Total Dividen" value={fmt(engine.totalDiv)} icon={Banknote} />
              <MiniStat label="Nilai Portfolio" value={fmt(engine.portfolioValue)} icon={Wallet} />
              <MiniStat label="Nilai Deposito" value={fmt(engine.depositValue)} icon={Activity} />
            </section>

            {/* ── HISTORY TABLE ── */}
            <section id="history" className="bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-slate-800/50">
                <h2 className="text-base font-semibold text-slate-100">Riwayat Dividen · {ticker}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{filtered.length} event tercatat</p>
              </div>
              {/* Desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="text-left px-6 py-3 font-medium">Tahun</th>
                      <th className="text-left px-6 py-3 font-medium">Cum Date</th>
                      <th className="text-right px-6 py-3 font-medium">Cum Price</th>
                      <th className="text-right px-6 py-3 font-medium">Ex Price</th>
                      <th className="text-right px-6 py-3 font-medium">Drop</th>
                      <th className="text-right px-6 py-3 font-medium">Recovery</th>
                      <th className="text-center px-6 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filtered.map((row) => {
                      const drop = ((row.Ex_Price_1day - row.Cum_Price) / row.Cum_Price) * 100;
                      const recovered = row.Status_Recovery.includes("Sudah");
                      return (
                        <tr key={`${row.Ticker}-${row.Year}`} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-3.5 text-slate-100 font-medium">{row.Year}</td>
                          <td className="px-6 py-3.5 text-slate-400">{row.Cum_Date}</td>
                          <td className="px-6 py-3.5 text-right text-slate-300">{row.Cum_Price.toLocaleString("id-ID")}</td>
                          <td className="px-6 py-3.5 text-right text-slate-300">{row.Ex_Price_1day.toLocaleString("id-ID")}</td>
                          <td className={`px-6 py-3.5 text-right font-medium ${drop < -3 ? "text-rose-400" : "text-amber-400"}`}>{drop.toFixed(1)}%</td>
                          <td className="px-6 py-3.5 text-right"><span className={`inline-flex items-center gap-1 ${row.Recovery_Days > 40 ? "text-rose-400" : row.Recovery_Days > 20 ? "text-amber-400" : "text-emerald-400"}`}>{row.Recovery_Days}d</span></td>
                          <td className="px-6 py-3.5 text-center">
                            {recovered
                              ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400"><CheckCircle2 className="w-3 h-3" />Pulih</span>
                              : <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400"><XCircle className="w-3 h-3" />Belum</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Mobile */}
              <div className="sm:hidden divide-y divide-slate-800/50">
                {filtered.map((row) => {
                  const drop = ((row.Ex_Price_1day - row.Cum_Price) / row.Cum_Price) * 100;
                  const recovered = row.Status_Recovery.includes("Sudah");
                  return (
                    <div key={`m-${row.Ticker}-${row.Year}`} className="px-4 py-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-100 font-medium">{row.Year}</span>
                        {recovered
                          ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400"><CheckCircle2 className="w-3 h-3" />Pulih</span>
                          : <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400"><XCircle className="w-3 h-3" />Belum</span>}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><p className="text-slate-500">Cum</p><p className="text-slate-300">{row.Cum_Price.toLocaleString("id-ID")}</p></div>
                        <div><p className="text-slate-500">Drop</p><p className={drop < -3 ? "text-rose-400" : "text-amber-400"}>{drop.toFixed(1)}%</p></div>
                        <div><p className="text-slate-500">Recovery</p><p className={row.Recovery_Days > 40 ? "text-rose-400" : "text-emerald-400"}>{row.Recovery_Days}d</p></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* ── FOOTER ── */}
        <footer className="text-center py-8 border-t border-slate-800/30">
          <p className="text-xs text-slate-600">Dividown · Data historis, bukan rekomendasi investasi.</p>
          <p className="text-[10px] text-slate-700 mt-1">Built with React + Recharts + Tailwind</p>
        </footer>
      </main>
    </div>
  );
}

// ── Sub Components ──
function MetricCard({ icon: Icon, label, value, sub, positive }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5 hover:border-slate-700/50 transition-all group">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${positive ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
          <Icon className={`w-4 h-4 ${positive ? "text-emerald-400" : "text-rose-400"}`} />
        </div>
      </div>
      <p className={`text-2xl font-semibold tracking-tight ${positive ? "text-emerald-400" : "text-rose-400"}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }) {
  return (
    <div className="bg-slate-900/30 border border-slate-800/30 rounded-xl px-4 py-3 flex items-center gap-3">
      <Icon className="w-4 h-4 text-slate-600 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-slate-600 font-medium">{label}</p>
        <p className="text-sm font-medium text-slate-200 truncate">{value}</p>
      </div>
    </div>
  );
}