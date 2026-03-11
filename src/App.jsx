import React, { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar.jsx";

const HomePage = lazy(() => import("./pages/HomePage.jsx"));
const ScreenerPage = lazy(() => import("./pages/ScreenerPage.jsx"));
const TickerPage = lazy(() => import("./pages/TickerPage.jsx"));
const ComparePage = lazy(() => import("./pages/ComparePage.jsx"));
const SavedPage = lazy(() => import("./pages/SavedPage.jsx"));

function LoadingPage() {
  return (
    <div className="loading">
      <div className="spinner" />
      <span>Loading terminal…</span>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Sidebar />
        <main className="main terminal-main">
          <Suspense fallback={<LoadingPage />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/screener" element={<ScreenerPage />} />
              <Route path="/ticker/:symbol" element={<TickerPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/saved" element={<SavedPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
}
