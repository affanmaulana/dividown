import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import { Outlet } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";

export default function Layout() {
  const location = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-indigo-100 selection:text-indigo-900">
      <Navbar />
      <main key={location.pathname} className="animate-fade-in-up">
        <Outlet />
      </main>
      <Analytics />
    </div>
  );
}
