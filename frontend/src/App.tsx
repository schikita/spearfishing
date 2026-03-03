import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import MapPage from './pages/MapPage';
import Reference from './pages/Reference';
import Contacts from './pages/Contacts';
import Login from './pages/Login';
import Admin from './pages/Admin';
import Subscription from './pages/Subscription';
import SubscriptionSuccess from './pages/SubscriptionSuccess';

function ProtectedAdmin() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Загрузка…</div>;
  if (!user || user.role !== 'admin') return <Navigate to="/login" replace />;
  return <Admin />;
}

function ProtectedMap() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Загрузка…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin' && !user.hasAccess) {
    return (
      <div className="page-loading" style={{ flexDirection: 'column', gap: '1rem' }}>
        <p>Доступ к карте не активирован.</p>
        <p>Обратитесь к администратору для получения доступа.</p>
      </div>
    );
  }
  return <MapPage />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="map" element={<ProtectedMap />} />
        <Route path="reference" element={<Reference />} />
        <Route path="reference/:slug" element={<Reference />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="login" element={<Login />} />
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
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
