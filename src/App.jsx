import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import LandingPage from "./LandingPage";
import StockDetail from "./StockDetail";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/stock/:ticker" element={<StockDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
