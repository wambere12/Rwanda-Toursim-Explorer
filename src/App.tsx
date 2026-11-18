import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.tsx';
import { Navbar } from './components/layout/Navbar.tsx';
import { Footer } from './components/layout/Footer.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { DiscoverPage } from './pages/DiscoverPage.tsx';
import { DestinationDetailPage } from './pages/DestinationDetailPage.tsx';
import { MapExplorerPage } from './pages/MapExplorerPage.tsx';
import { PlannerPage } from './pages/PlannerPage.tsx';
import { StaysPage } from './pages/StaysPage.tsx';
import { ProvidersPage } from './pages/ProvidersPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';

const AppShell: React.FC = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F5] text-[#202923]">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/destinations/:slug" element={<DestinationDetailPage />} />
          <Route path="/map" element={<MapExplorerPage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/planner/:shareCode" element={<PlannerPage />} />
          <Route path="/stays" element={<StaysPage />} />
          <Route path="/providers" element={<ProvidersPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isAdminRoute && <Footer />}
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
