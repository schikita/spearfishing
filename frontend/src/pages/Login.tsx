import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import styles from './Login.module.css';

type Mode = 'login' | 'register';

export default function Login() {
  const [searchParams] = useSearchParams();
  const initialMode = (searchParams.get('mode') === 'register' ? 'register' : 'login') as Mode;
  const [mode, setMode] = useState<Mode>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const redirect = searchParams.get('redirect') || '/';

  if (user) {
    navigate(redirect, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('Пароли не совпадают');
        return;
      }
      if (password.length < 6) {
        setError('Пароль должен быть не менее 6 символов');
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password);
      }
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === 'login' ? 'Ошибка входа' : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className={styles.wrap}>
        <div className={styles.card}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={mode === 'login' ? styles.tabActive : ''}
              onClick={() => { setMode('login'); setError(''); }}
            >
              Вход
            </button>
            <button
              type="button"
              className={mode === 'register' ? styles.tabActive : ''}
              onClick={() => { setMode('register'); setError(''); }}
            >
              Регистрация
            </button>
          </div>
          <form className={styles.form} onSubmit={handleSubmit}>
          <h1>{mode === 'login' ? 'Вход' : 'Регистрация'}</h1>
          {error && <div className={styles.error}>{error}</div>}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder={mode === 'login' ? 'admin@example.com' : 'example@mail.com'}
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'register' ? 6 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={mode === 'register' ? 'Не менее 6 символов' : undefined}
            />
          </label>
          {mode === 'register' && (
            <label>
              Подтвердите пароль
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>
          )}
          <button type="submit" disabled={loading}>
            {loading
              ? (mode === 'login' ? 'Вход…' : 'Регистрация…')
              : (mode === 'login' ? 'Войти' : 'Зарегистрироваться')}
          </button>
        </form>
        </div>
      </div>
    </AuthLayout>
  );
}
