import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import styles from './Login.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';

  if (user) {
    navigate(redirect, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className={styles.wrap}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <h1>Вход</h1>
          {error && <div className={styles.error}>{error}</div>}
          <label>
            Email
            <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="admin@example.com"
            />
          </label>
          <label>
            Пароль
            <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Вход…' : 'Войти'}
          </button>
          <p className={styles.footer}>
            Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
          </p>
        </form>
      </div>
    </AuthLayout>
  );
}
