import { Shield, TriangleAlert, OctagonAlert } from "lucide-react";

export function calculateHealthScore(events) {
  if (!events || !events.length) return null;

  let score = 0;
  
  const avgRecDays = events.reduce((s, r) => s + (r.Recovery_Days || 0), 0) / events.length;
  if (avgRecDays < 30) score += 40;

  const pulihCount = events.filter((r) => (r.Status_Recovery || "").includes("Pulih")).length;
  if (pulihCount === events.length) score += 30;

  const avgDrop = events.reduce((s, r) => {
    const cp = r.Cum_Price || 1; // Prevent division by zero
    const drop = Math.abs((((r.Ex_Price_1day || cp) - cp) / cp) * 100);
    return s + drop;
  }, 0) / events.length;
  if (avgDrop < 5) score += 30;

  let label, tier, badgeClass, bgClass, textClass, Icon;
  if (score >= 80) {
    label = "Safe";
    tier = "low";
    badgeClass = "bg-emerald-50 text-emerald-700 ring-emerald-200/50";
    bgClass = "bg-emerald-500";
    textClass = "text-emerald-700";
    Icon = Shield;
  } else if (score >= 50) {
    label = "Watch";
    tier = "medium";
    badgeClass = "bg-amber-50 text-amber-700 ring-amber-200/50";
    bgClass = "bg-amber-500";
    textClass = "text-amber-700";
    Icon = TriangleAlert;
  } else {
    label = "Trap";
    tier = "high";
    badgeClass = "bg-rose-50 text-rose-700 ring-rose-200/50";
    bgClass = "bg-rose-500";
    textClass = "text-rose-700";
    Icon = OctagonAlert;
  }

  return { score, label, tier, badgeClass, bgClass, textClass, Icon };
}
