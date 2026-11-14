import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';

const MapPage = lazy(() => import('./pages/MapPage'));
const Reference = lazy(() => import('./pages/Reference'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Info = lazy(() => import('./pages/Info'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const Login = lazy(() => import('./pages/Login'));
const Admin = lazy(() => import('./pages/Admin'));
const Subscription = lazy(() => import('./pages/Subscription'));
const SubscriptionSuccess = lazy(() => import('./pages/SubscriptionSuccess'));
const WaterBodyPage = lazy(() => import('./pages/WaterBodyPage'));
const Blog = lazy(() => import('./pages/Blog'));

function PageFallback() {
  return <div className="page-loading">Загрузка…</div>;
}

function ProtectedAdmin() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Загрузка…</div>;
  if (!user || user.role !== 'admin') return <Navigate to="/login" replace />;
  return <Admin />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="map" element={<MapPage />} />
          <Route path="water/:id" element={<WaterBodyPage />} />
          <Route path="reference" element={<Reference />} />
          <Route path="reference/:slug" element={<Reference />} />
          <Route path="blog" element={<Blog />} />
          <Route path="blog/:slug" element={<Blog />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="info" element={<Info />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Navigate to="/login?mode=register" replace />} />
          <Route path="subscription" element={<Subscription />} />
          <Route path="subscription/success" element={<SubscriptionSuccess />} />
          <Route path="admin/*" element={<ProtectedAdmin />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </HelmetProvider>
  );
}
