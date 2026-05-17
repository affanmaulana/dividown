import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import Skeleton from "./components/Skeleton";

// Lazy load route pages to improve LCP and initial bundle size (Core Web Vitals)
const LandingPage = lazy(() => import("./pages/LandingPage"));
const StockDetail = lazy(() => import("./pages/StockDetail"));
const ComparePage = lazy(() => import("./pages/ComparePage"));

// ── HIGH-FIDELITY SKELETON FALLBACKS ───────────────────────────────────────
const LandingPageSkeleton = () => (
  <div className="min-h-screen bg-white">
    <section className="py-24 px-4 md:px-6 text-center max-w-4xl mx-auto">
      <div className="flex justify-center gap-3 mb-10">
        <Skeleton className="w-24 h-7 rounded-full" />
        <Skeleton className="w-24 h-7 rounded-full" />
      </div>
      <Skeleton className="w-3/4 h-16 md:h-24 mx-auto mb-6" />
      <Skeleton className="w-1/2 h-6 mx-auto mb-12" />
      <div className="flex flex-col items-center gap-6">
        <Skeleton className="w-full max-w-2xl h-14 rounded-full" />
        <div className="flex flex-wrap justify-center gap-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="w-20 h-9 rounded-full" />)}
        </div>
      </div>
    </section>
    <section className="px-4 md:px-6 pb-24 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-8">
            <div className="flex justify-between">
              <div className="space-y-2">
                <Skeleton className="w-24 h-10" />
                <Skeleton className="w-16 h-3" />
              </div>
              <Skeleton className="w-20 h-6 rounded-full" />
            </div>
            <div className="pt-6 border-t border-slate-50 flex justify-between">
              <div className="space-y-2">
                <Skeleton className="w-20 h-3" />
                <Skeleton className="w-16 h-6" />
              </div>
              <div className="space-y-2 items-end flex flex-col">
                <Skeleton className="w-16 h-3" />
                <Skeleton className="w-12 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  </div>
);

const StockDetailSkeleton = () => (
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

const ComparePageSkeleton = () => (
  <div className="font-sans bg-slate-50 min-h-screen">
    <main className="max-w-6xl mx-auto px-4 md:px-6 py-12 space-y-8">
      <div className="space-y-6">
        <Skeleton className="w-32 h-6 rounded-full" />
        <div className="flex justify-between items-center">
          <Skeleton className="w-64 h-12" />
          <Skeleton className="w-32 h-10 rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>

      <Skeleton className="w-full h-48 rounded-2xl" />
      <Skeleton className="w-full h-[400px] rounded-3xl" />
    </main>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route
            path="/"
            element={
              <Suspense fallback={<LandingPageSkeleton />}>
                <LandingPage />
              </Suspense>
            }
          />
          <Route
            path="/stock/:ticker"
            element={
              <Suspense fallback={<StockDetailSkeleton />}>
                <StockDetail />
              </Suspense>
            }
          />
          <Route
            path="/compare"
            element={
              <Suspense fallback={<ComparePageSkeleton />}>
                <ComparePage />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
