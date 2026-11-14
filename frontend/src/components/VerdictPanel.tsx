import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, WaterVerdict } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { todayISO } from '../tripDate';
import styles from './VerdictPanel.module.css';

const COLOR_OPTIONS = [
  { id: 'clear', label: 'прозрачная' },
  { id: 'green', label: 'зелёная' },
  { id: 'brown', label: 'мутная, коричневая' },
  { id: 'bloom', label: 'цветение' },
];

export default function VerdictPanel({
  waterBodyId,
  date,
  lat,
  lng,
  onBuildRoute,
}: {
  waterBodyId: number;
  date: string;
  lat?: number;
  lng?: number;
  onBuildRoute?: () => void;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<WaterVerdict | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportMsg, setReportMsg] = useState('');
  const [fixMsg, setFixMsg] = useState('');
  const [visibilityM, setVisibilityM] = useState('3');
  const [observedOn, setObservedOn] = useState(todayISO());
  const [waterColor, setWaterColor] = useState('clear');
  const [note, setNote] = useState('');
  const [suggestionType, setSuggestionType] = useState('geometry');
  const [fixText, setFixText] = useState('');
  const [contact, setContact] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .verdict(waterBodyId, date, lat, lng)
      .then(setData)
      .catch((e) => setError(e.message || 'Не удалось собрать сводку'))
      .finally(() => setLoading(false));
  }, [waterBodyId, date, lat, lng]);

  const sendReport = async (e: FormEvent) => {
    e.preventDefault();
    setReportMsg('');
    try {
      const res = await api.visibilityReport(waterBodyId, {
        observedOn,
        visibilityM: Number(visibilityM),
        waterColor,
        note,
      });
      setReportMsg(res.message);
      setNote('');
    } catch (err) {
      setReportMsg(err instanceof Error ? err.message : 'Не удалось отправить');
    }
  };

  const sendFix = async (e: FormEvent) => {
    e.preventDefault();
    setFixMsg('');
    try {
      await api.correction({ waterBodyId, suggestionType, message: fixText, contact });
      setFixMsg('Исправление отправлено. На карту оно попадёт только после проверки.');
      setFixText('');
    } catch (err) {
      setFixMsg(err instanceof Error ? err.message : 'Не удалось отправить');
    }
  };

  if (loading) return <div className={styles.panel}>Собираем сводку на {date}…</div>;
  if (error || !data) return <div className={styles.error}>{error || 'Нет данных'}</div>;

  const verifyClass =
    data.verification.status === 'needs_review' || data.verification.status === 'name_conflict'
      ? styles.badgeWarn
      : styles.badgeNeutral;

  return (
    <div className={styles.panel}>
      <p className={styles.disclaimer}>{data.disclaimer}</p>
      <div>
        <h2>Можно / нельзя</h2>
        <p className={styles.muted}>На дату {data.date}. Это отдельные факты, а не разрешение охотиться.</p>
      </div>

      <section className={styles.block}>
        <h3>Перечень</h3>
        <span className={`${styles.badge} ${data.onOfficialList.listed ? styles.badgeOk : styles.badgeWarn}`}>
          {data.onOfficialList.listed ? 'в перечне облисполкома' : 'записи решения нет'}
        </span>
        <p>{data.onOfficialList.note}</p>
        {data.onOfficialList.documentTitle && (
          <p className={styles.muted}>
            {data.onOfficialList.documentTitle}
            {data.onOfficialList.documentRef ? `, ${data.onOfficialList.documentRef}` : ''}
            {data.onOfficialList.documentDate ? `, ${data.onOfficialList.documentDate}` : ''}
          </p>
        )}
        {data.onOfficialList.excerpt && <p className={styles.muted}>Участок: {data.onOfficialList.excerpt}</p>}
      </section>

      <section className={styles.block}>
        <h3>Путёвка</h3>
        <p>{data.permit.note}</p>
        {data.permit.organization && (
          <p>
            {data.permit.organization.url ? (
              <a href={data.permit.organization.url} target="_blank" rel="noreferrer">
                {data.permit.organization.name}
              </a>
            ) : (
              data.permit.organization.name
            )}
          </p>
        )}
      </section>

      <section className={data.winteringPits.recorded ? styles.danger : styles.block}>
        <h3>Зимовальные ямы</h3>
        <strong>{data.winteringPits.message}</strong>
        {data.winteringPits.items.map((pit) => (
          <p key={pit.id}>
            {pit.name}. Запрет: {pit.banPeriod}.
            {pit.boundariesUncertain ? ' Границы уточняются.' : ''}
            {pit.contourMissing ? ' Контур не нанесён.' : ''}
            {pit.sourceTitle ? ` Источник: ${pit.sourceTitle}.` : ''}
            {pit.sourceDate ? ` ${pit.sourceDate}.` : ''}
          </p>
        ))}
        {data.winteringPits.userPoint && data.winteringPits.userPoint.inside.length > 0 && (
          <p>Ваша точка попадает в зимовальную яму. Подводная охота в ней запрещена.</p>
        )}
      </section>

      <section className={styles.block}>
        <h3>Внешняя карта</h3>
        <span className={`${styles.badge} ${verifyClass}`}>{data.verification.label}</span>
        <p className={styles.muted}>{data.verification.note}</p>
      </section>

      <section className={styles.block}>
        <h3>Погода для ныряния</h3>
        <p>
          Мутность: {data.risks.turbidity.label}. Цветение: {data.risks.bloom.label}. Дорога: {data.risks.road.label}.
        </p>
        {data.risks.weather === 'missing' && <p className={styles.muted}>Сводка осадков пока не загрузилась. Это не «условия хорошие».</p>}
        <p className={styles.muted}>
          Ветер {data.risks.diving.windSpeedMs ?? '—'} м/с
          {data.risks.diving.windDirDeg != null ? `, направление ${Math.round(data.risks.diving.windDirDeg)}°` : ''}.
          Давление {data.risks.diving.pressureHpa != null ? `${Math.round(data.risks.diving.pressureHpa)} гПа` : '—'}.
          Воздух {data.risks.diving.airTempC ?? '—'} °C. Вода {data.risks.diving.waterTempC ?? '—'} °C.
        </p>
        <p className={styles.muted}>{data.risks.diving.waterTempNote}</p>
      </section>

      <section className={styles.block}>
        <h3>Что проверить перед выездом</h3>
        <ul className={styles.checklist}>
          {data.checklist.map((item) => (
            <li key={item.id}>{item.text}</li>
          ))}
        </ul>
      </section>

      {data.reports.length > 0 && (
        <section className={styles.block}>
          <h3>Свежие отчёты</h3>
          {data.reports.map((report) => (
            <p key={report.id} className={styles.muted}>
              {report.observedOn}: видимость {report.visibilityM} м{report.waterColor ? `, ${report.waterColor}` : ''}
              {report.affectsMap ? '' : ' (на цвет карты не влияет)'}
            </p>
          ))}
        </section>
      )}

      {onBuildRoute && (
        <button type="button" className={styles.linkBtn} onClick={onBuildRoute}>
          Построить маршрут
        </button>
      )}
      <Link to={`/water/${waterBodyId}`}>Карточка водоёма</Link>

      <section className={styles.block}>
        <h3>Свежая прозрачность</h3>
        {user ? (
          <form className={styles.form} onSubmit={sendReport}>
            <input type="date" value={observedOn} onChange={(e) => setObservedOn(e.target.value)} required />
            <input
              type="number"
              min="0"
              max="30"
              step="0.1"
              value={visibilityM}
              onChange={(e) => setVisibilityM(e.target.value)}
              aria-label="Видимость в метрах"
              required
            />
            <select value={waterColor} onChange={(e) => setWaterColor(e.target.value)}>
              {COLOR_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Коротко, без трофеев и веса рыбы" />
            <button type="submit">Отправить на проверку</button>
            {reportMsg && <p className={reportMsg.startsWith('Отчёт') ? styles.ok : styles.error}>{reportMsg}</p>}
          </form>
        ) : (
          <p>
            <Link to="/login">Войдите</Link>, чтобы оставить отчёт о видимости. На карте он появится после проверки.
          </p>
        )}
      </section>

      <section className={styles.block}>
        <h3>Предложить исправление</h3>
        <form className={styles.form} onSubmit={sendFix}>
          <select value={suggestionType} onChange={(e) => setSuggestionType(e.target.value)}>
            <option value="geometry">Граница участка</option>
            <option value="name">Название</option>
            <option value="permission">Разрешение</option>
            <option value="wintering_pit">Зимовальная яма</option>
            <option value="other">Другое</option>
          </select>
          <textarea value={fixText} onChange={(e) => setFixText(e.target.value)} minLength={5} required placeholder="Что исправить и откуда сведения" />
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Telegram или почта, необязательно" />
          <button type="submit">Отправить</button>
          {fixMsg && <p className={fixMsg.startsWith('Исправление') ? styles.ok : styles.error}>{fixMsg}</p>}
        </form>
      </section>
    </div>
  );
}
