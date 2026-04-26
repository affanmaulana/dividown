import Navbar from "./components/Navbar";
import { Outlet } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 selection:bg-indigo-100 selection:text-indigo-900">
      <Navbar />
      <main>
        <Outlet />
      </main>
      <Analytics />
    </div>
  );
}
