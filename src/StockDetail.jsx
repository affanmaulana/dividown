import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, Banknote, Clock, Wallet, BarChart3,
  Activity, CheckCircle2, XCircle
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
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-4 font-sans">
      <p className="font-semibold text-slate-950 mb-1">{displayYear}</p>
      {dividendType && (
        <p className={`text-xs font-medium ${typeClass} mb-3`}>{dividendType}</p>
      )}
      <div className="space-y-2">
        {payload.map((p) => (
          <div key={p.name} className="flex justify-between items-center text-sm min-w-[140px]">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-slate-500 font-medium">{p.name}</span>
            </span>
            <span className="font-semibold text-slate-900">{fmt(p.value)}</span>
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
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-4 font-sans">
      <p className="font-semibold text-slate-950 mb-3">{displayDate}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between items-center text-sm gap-6">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-500 font-medium">{p.name}</span>
          </span>
          <span className="font-semibold text-slate-900">{fmt(p.value)}</span>
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
  const [capital, setCapital] = useState(10000000);
  const [strategy, setStrategy] = useState("reinvest");
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
    () => data.filter((d) => d.Ticker === ticker).sort((a, b) => a.Year - b.Year),
    [data, ticker]
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
      id: i,
      year: r.Year,
      dividendType: r.dividendType,
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

  const health = useMemo(() => calculateHealthScore(filtered), [filtered]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 tracking-wide font-sans">Menganalisis saham…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans">
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">

        {/* ── HEADER ── */}
        <div className="mb-8">
          <button 
            onClick={() => navigate('/')} 
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Discovery
          </button>
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-950 tracking-tight">{ticker}</h1>
            {health && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ring-1 ${health.badgeClass}`}>
                <health.Icon className="w-4 h-4" />
                {health.label}
              </div>
            )}
          </div>
          <p className="text-base text-slate-500 max-w-2xl">
            Analisis historis dan simulasi return portofolio vs deposito 4% p.a. untuk saham {ticker}.
          </p>
        </div>

        {/* ── CONTROL PANEL ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          {/* Capital */}
          <div>
            <label htmlFor="capital-input" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Modal Awal (IDR)
            </label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="capital-input"
                type="number"
                value={capital}
                onChange={(e) => setCapital(Number(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Strategy */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Strategi Dividen
            </label>
            <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-1">
              {[{ key: "reinvest", label: "Reinvest" }, { key: "cash", label: "Tunai" }].map((s) => (
                <button
                  key={s.key}
                  id={`strategy-${s.key}`}
                  onClick={() => setStrategy(s.key)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    strategy === s.key
                    ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50"
                    : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {engine && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ── METRIC CARDS ── */}
            <div id="metrics" className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
            <div id="chart" className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-8 gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Performa Portfolio</h2>
                  <p className="text-sm text-slate-500 mt-1">Portfolio Value vs Deposito Baseline (4% p.a.)</p>
                </div>
                <div className="flex items-center gap-5">
                  <LegendDot color="bg-indigo-500" label="Portfolio" />
                  <LegendDot color="bg-slate-300" label="Deposito" />
                </div>
              </div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={engine.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gPortfolio" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gDeposit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="id" 
                      tickFormatter={(id) => engine.chartData[id]?.year}
                      tick={{ fontSize: 12, fill: "#64748b", fontWeight: 500 }} 
                      axisLine={false} 
                      tickLine={false}
                      dy={10}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#64748b", fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${(v / 1e6).toFixed(0)}jt`}
                      width={50}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Area
                      type="monotone"
                      dataKey="Portfolio"
                      stroke="#4f46e5"
                      strokeWidth={3}
                      fill="url(#gPortfolio)"
                      dot={{ r: 4, fill: "#4f46e5", stroke: "#fff", strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: "#4f46e5", stroke: "#fff", strokeWidth: 2 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Deposito"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      strokeDasharray="5 5"
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
              <div id="price-chart" className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-8 gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">Market Price History</h2>
                    <p className="text-sm text-slate-500 mt-1">Monthly closing price for data validation</p>
                  </div>
                  <div className="flex items-center gap-5">
                    <LegendDot color="bg-slate-400" label="Price (IDR)" />
                  </div>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredPrices} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#cbd5e1" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#f8fafc" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis 
                        dataKey="Date" 
                        tickFormatter={(val) => new Date(val).getFullYear()}
                        tick={{ fontSize: 12, fill: "#64748b", fontWeight: 500 }} 
                        axisLine={false} 
                        tickLine={false}
                        minTickGap={40}
                        dy={10}
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 12, fill: "#64748b", fontWeight: 500 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => v.toLocaleString("id-ID")}
                        width={55}
                      />
                      <Tooltip content={<CustomPriceTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
                      <Area
                        type="monotone"
                        dataKey="Price"
                        name="Harga Penutupan"
                        stroke="#94a3b8"
                        strokeWidth={2}
                        fill="url(#gPrice)"
                        activeDot={{ r: 5, fill: "#fff", stroke: "#94a3b8", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── SUMMARY ROW ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MiniStat icon={BarChart3} label="Lembar Saham" value={engine.currentShares.toLocaleString("id-ID")} />
              <MiniStat icon={Banknote} label="Total Dividen" value={fmt(engine.totalDiv)} />
              <MiniStat icon={Wallet} label="Nilai Portfolio" value={fmt(engine.portfolioValue)} />
              <MiniStat icon={Activity} label="Nilai Deposito" value={fmt(engine.depositValue)} />
            </div>

            {/* ── HISTORY TABLE ── */}
            <div id="history" className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Riwayat Dividen</h2>
                <p className="text-sm text-slate-500 mt-0.5">{filtered.length} event historis tercatat</p>
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white border-b border-slate-100">
                    <tr>
                      {["Tahun", "Cum Date", "Cum Price", "Ex Price", "Drop", "Recovery", "Status"].map((h, i) => (
                        <th
                          key={h}
                          className={`px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider ${i >= 2 ? "text-right" : "text-left"} ${i === 6 ? "text-center" : ""}`}
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
                        <tr key={`${row.Ticker}-${row.Year}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-800">{row.Year}</td>
                          <td className="px-6 py-4 text-slate-500 font-medium">{row.Cum_Date}</td>
                          <td className="px-6 py-4 text-right text-slate-700 font-medium">{row.Cum_Price.toLocaleString("id-ID")}</td>
                          <td className="px-6 py-4 text-right text-slate-700 font-medium">{row.Ex_Price_1day.toLocaleString("id-ID")}</td>
                          <td className={`px-6 py-4 text-right font-bold ${drop < -3 ? "text-rose-600" : "text-slate-600"}`}>
                            {drop.toFixed(1)}%
                          </td>
                          <td className={`px-6 py-4 text-right font-bold ${row.Recovery_Days > 40 ? "text-rose-600" : row.Recovery_Days > 20 ? "text-amber-600" : "text-emerald-600"}`}>
                            {row.Recovery_Days}d
                          </td>
                          <td className="px-6 py-4 text-center">
                            {recovered ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Pulih
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-200/50">
                                <XCircle className="w-3.5 h-3.5" /> Belum
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
                    <div key={`m-${row.Ticker}-${row.Year}`} className="px-5 py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-lg">{row.Year}</span>
                        {recovered ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Pulih
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-200/50">
                            <XCircle className="w-3.5 h-3.5" /> Belum
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Cum Price</p>
                          <p className="font-bold text-slate-800">{row.Cum_Price.toLocaleString("id-ID")}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Drop</p>
                          <p className={`font-bold ${drop < -3 ? "text-rose-600" : "text-slate-700"}`}>{drop.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Recovery</p>
                          <p className={`font-bold ${row.Recovery_Days > 40 ? "text-rose-600" : "text-emerald-600"}`}>{row.Recovery_Days}d</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${positive ? "bg-emerald-50 group-hover:bg-emerald-100" : "bg-rose-50 group-hover:bg-rose-100"}`}>
          <Icon className={`w-5 h-5 ${positive ? "text-emerald-600" : "text-rose-600"}`} />
        </div>
      </div>
      <p className={`text-3xl font-extrabold tracking-tight ${positive ? "text-emerald-600" : "text-rose-600"}`}>{value}</p>
      <p className="text-sm font-medium text-slate-500 mt-2">{sub}</p>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
        <Icon className="w-5 h-5 text-indigo-600" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-sm font-bold text-slate-900 truncate">{value}</p>
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-3 h-3 rounded-full ${color} shadow-sm`} />
      <span className="text-sm font-semibold text-slate-600">{label}</span>
    </div>
  );
}
