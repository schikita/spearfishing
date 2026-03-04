import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import styles from './Subscription.module.css';

type Plan = { id: string; days: number; amount: string; label: string; currency: string };

export default function Subscription() {
  const { user, loading: authLoading } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('1m');
  const [status, setStatus] = useState<{ hasAccess: boolean; expiresAt: string | null } | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.subscription.plans().then((r) => setPlans(r.plans)).catch(() => {});
  }, []);

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
      const { paymentUrl } = await api.subscription.create(selectedPlan);
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
        возможностью построения маршрута от вашего местоположения.
      </p>

      <section className={styles.plans}>
        <h2>Тарифы</h2>
        <div className={styles.planGrid}>
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              className={`${styles.planCard} ${selectedPlan === plan.id ? styles.planSelected : ''}`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              <span className={styles.planAmount}>{plan.amount} {plan.currency}</span>
              <span className={styles.planLabel}>{plan.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.rules}>
        <h2>Особенности подписки</h2>
        <ul>
          <li><strong>Подписка привязана к аккаунту.</strong> Доступ к карте предоставляется по email — войдите в свой аккаунт с любого устройства.</li>
          <li>Один аккаунт — одна подписка. Используйте карту с любого устройства, где вы авторизованы.</li>
        </ul>
      </section>

      {error && <div className={styles.error}>{error}</div>}
      <button type="button" className={styles.btn} onClick={handlePay} disabled={payLoading}>
        {payLoading ? 'Создание платежа…' : `Оплатить ${plans.find((p) => p.id === selectedPlan)?.amount || ''} ${plans.find((p) => p.id === selectedPlan)?.currency || 'BYN'}`}
      </button>
      <p className={styles.note}>
        После оплаты доступ к карте активируется автоматически. Оплата через ЮKassa (банковские карты).
      </p>
      <p className={styles.back}>
        <Link to="/">← На главную</Link>
      </p>
    </div>
  );
}
