import { Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import MapPage from './pages/MapPage';
import Reference from './pages/Reference';
import Contacts from './pages/Contacts';
import Info from './pages/Info';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Login from './pages/Login';
import Admin from './pages/Admin';
import Subscription from './pages/Subscription';
import SubscriptionSuccess from './pages/SubscriptionSuccess';
import WaterBodyPage from './pages/WaterBodyPage';
import Blog from './pages/Blog';

function ProtectedAdmin() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Загрузка…</div>;
  if (!user || user.role !== 'admin') return <Navigate to="/login" replace />;
  return <Admin />;
}

function AppRoutes() {
  return (
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
