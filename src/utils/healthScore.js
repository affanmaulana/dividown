import { Shield, TriangleAlert, OctagonAlert, Star } from "lucide-react";

const getMedian = (values) => {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

export function calculateHealthScore(events, latestPrice = null) {
  if (!events || !events.length) return null;

  // 1. Calculate Metrics
  const recoveryDays = events.map(r => r.Recovery_Days || 0);
  const medianRec = getMedian(recoveryDays);
  
  const drops = events.map(r => {
    const cp = r.Cum_Price || 1;
    return Math.abs((((r.Ex_Price_1day || cp) - cp) / cp) * 100);
  });
  const meanDrop = drops.reduce((s, d) => s + d, 0) / (drops.length || 1);

  const years = [...new Set(events.map(d => d.Year))];
  const annualYields = years.map(y => {
    const yearEvents = events.filter(d => d.Year === y);
    const totalDiv = yearEvents.reduce((s, e) => s + (e.Dividend || 0), 0);
    const avgPrice = yearEvents.reduce((s, e) => s + (e.Cum_Price || 0), 0) / yearEvents.length;
    return (totalDiv / (avgPrice || 1)) * 100;
  });
  const avgYield = annualYields.length > 0 ? annualYields.reduce((s, y) => s + y, 0) / annualYields.length : 0;

  // 2. Bearish Detection (Drop Again)
  let isBearish = false;
  let dropAgainCount = 0;
  if (latestPrice) {
    const recoveredEvents = events.filter(r => r.Status_Recovery === "Pulih");
    dropAgainCount = recoveredEvents.filter(r => latestPrice < (r.Cum_Price * 0.95)).length;
    // If more than 30% of recovered events are currently dropped again
    if (recoveredEvents.length > 0 && (dropAgainCount / recoveredEvents.length) >= 0.3) {
      isBearish = true;
    }
  }

  // 3. Safety Score Calculation (1-10)
  // ... (rest of the logic stays the same but I need to include it in the replacement)
  const recoveryScore = Math.max(0, 10 * (1 - medianRec / 60)) * 0.6;
  const yieldRef = avgYield || 5; 
  const dropRatio = meanDrop / (yieldRef * 2);
  const dropScore = Math.max(0, 10 * (1 - dropRatio)) * 0.4;

  let score = recoveryScore + dropScore;
  
  const trapCount = events.filter(r => r.Status_Recovery === "Trap").length;
  if (trapCount > 0) {
    score = score * (1 - (trapCount / events.length) * 0.5);
  }

  score = Math.min(10, Math.max(1, score));

  // 4. Visuals & Labels
  let label, badgeClass, bgClass, textClass, Icon, reason;
  
  if (score >= 8.0) {
    label = "Safe";
    badgeClass = "bg-emerald-600 text-white";
    bgClass = "bg-emerald-500";
    textClass = "text-emerald-700";
    Icon = Shield;
    reason = "Emiten ini sangat aman. Harga cenderung pulih seketika dan penurunan saat ex-date sangat kecil dibanding dividen yang dibagikan.";
  } else if (score >= 5.0) {
    label = "Caution";
    badgeClass = "bg-amber-500 text-white";
    bgClass = "bg-amber-500";
    textClass = "text-amber-700";
    Icon = TriangleAlert;
    reason = "Emiten ini memiliki risiko moderat. Pemulihan harga mungkin memakan waktu beberapa minggu, atau terjadi penurunan yang cukup dalam.";
  } else {
    label = "Danger";
    badgeClass = "bg-rose-600 text-white";
    bgClass = "bg-rose-500";
    textClass = "text-rose-700";
    Icon = OctagonAlert;
    reason = "Risiko tinggi Dividend Trap! Secara historis, emiten ini sulit pulih ke harga modal dan penurunannya seringkali menghapus keuntungan dividen.";
  }

  return { 
    score: score.toFixed(1), 
    label, 
    badgeClass, 
    bgClass, 
    textClass, 
    Icon, 
    reason,
    avgYield,
    meanDrop,
    medianRec,
    isBearish,
    dropAgainCount
  };
}
