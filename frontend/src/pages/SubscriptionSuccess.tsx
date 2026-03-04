import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import styles from './Subscription.module.css';

export default function SubscriptionSuccess() {
  const { loadUser } = useAuth();
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      for (let i = 0; i < 10 && !cancelled; i++) {
        await loadUser?.();
        const s = await api.subscription.status().catch(() => null);
        if (s?.hasAccess) {
          setReady(true);
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      setReady(true);
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [loadUser]);

  return (
    <div className={styles.wrap}>
      <h1>Оплата прошла успешно</h1>
      {ready ? (
        <>
          <p>Доступ к карте активирован.</p>
          <button type="button" className={styles.btn} onClick={() => navigate('/map')}>
            Перейти к карте
          </button>
        </>
      ) : (
        <p>Активация доступа… Подождите несколько секунд.</p>
      )}
    </div>
  );
}
