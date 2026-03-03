import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import styles from './Subscription.module.css';

export default function Subscription() {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<{ hasAccess: boolean; expiresAt: string | null } | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    if (user.role === 'admin') {
      navigate('/map', { replace: true });
      return;
    }
    api.subscription
      .status()
      .then(setStatus)
      .catch(() => setStatus({ hasAccess: false, expiresAt: null }));
  }, [user, navigate]);

  const handlePay = async () => {
    setError('');
    setPayLoading(true);
    try {
      const { paymentUrl } = await api.subscription.create();
      window.location.href = paymentUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания платежа');
      setPayLoading(false);
    }
  };

  if (authLoading || !user) {
    return <div className={styles.wrap}>Загрузка…</div>;
  }

  if (user.role === 'admin') return null;

  if (status?.hasAccess) {
    return (
      <div className={styles.wrap}>
        <h1>Подписка активна</h1>
        <p>
          У вас есть доступ к карте водоёмов.
          {status.expiresAt && (
            <span> Подписка действует до {new Date(status.expiresAt).toLocaleDateString('ru-RU')}.</span>
          )}
        </p>
        <button type="button" className={styles.btn} onClick={() => navigate('/map')}>
          Перейти к карте
        </button>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <h1>Подписка на карту водоёмов</h1>
      <p className={styles.desc}>
        Карта содержит актуальный перечень водоёмов Беларуси, где разрешена подводная охота, с контурами и
        возможностью построения маршрута.
      </p>
      <div className={styles.price}>
        <span className={styles.amount}>9,99 ₽</span>
        <span className={styles.period}>в год</span>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <button type="button" className={styles.btn} onClick={handlePay} disabled={payLoading}>
        {payLoading ? 'Создание платежа…' : 'Оформить подписку'}
      </button>
      <p className={styles.note}>
        После оплаты доступ к карте активируется автоматически. Оплата через ЮKassa (банковские карты, ЮMoney и
        др.).
      </p>
    </div>
  );
}
