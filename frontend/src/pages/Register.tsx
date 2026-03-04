import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import styles from './Login.module.css';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, user } = useAuth();
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
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password);
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className={styles.wrap}>
        <form className={styles.form} onSubmit={handleSubmit}>
        <h1>Регистрация</h1>
        {error && <div className={styles.error}>{error}</div>}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="example@mail.com"
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Не менее 6 символов"
          />
        </label>
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
        <button type="submit" disabled={loading}>
          {loading ? 'Регистрация…' : 'Зарегистрироваться'}
        </button>
        <p className={styles.footer}>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </form>
      </div>
    </AuthLayout>
  );
}
