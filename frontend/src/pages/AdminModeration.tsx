import { FormEvent, useEffect, useState } from 'react';
import { api, CorrectionSuggestion, VisibilityReport, WinteringPit } from '../api/client';
import styles from './Admin.module.css';

export function AdminPits() {
  const [list, setList] = useState<WinteringPit[]>([]);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    name: '',
    region: '',
    waterBodyId: '',
    waterBodyNameRaw: '',
    lat: '',
    lng: '',
    radiusM: '',
    boundaryAccuracy: 'unknown',
    banFrom: '',
    banTo: '',
    isYearRound: true,
    sourceTitle: '',
    sourceUrl: '',
    sourceDate: '',
    status: 'needs_review',
    notes: 'Границы уточняются',
  });

  const load = () => {
    api.admin.winteringPits().then(setList).catch((e) => setMessage(e.message));
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      await api.admin.createWinteringPit({
        ...form,
        waterBodyId: form.waterBodyId ? Number(form.waterBodyId) : null,
        isYearRound: form.isYearRound ? 1 : 0,
      });
      setForm((f) => ({ ...f, name: '', lat: '', lng: '' }));
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const importFile = async (file: File) => {
    setMessage('');
    try {
      const geojson = JSON.parse(await file.text());
      const res = await api.admin.importWinteringPits(geojson);
      setMessage(`Импортировано ям: ${res.created}. Координаты берутся только из файла.`);
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Файл не прочитан');
    }
  };

  return (
    <div className={styles.section}>
      <h2>Зимовальные ямы</h2>
      <p>Не рисуйте контур наугад. Если границы неизвестны, оставьте координаты пустыми: запрет привяжется к водоёму, а на карте зоны не будет.</p>
      {message && <div className={styles.error}>{message}</div>}
      <form onSubmit={submit} className={styles.formGrid}>
        <input placeholder="Название" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="Область" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
        <input placeholder="ID водоёма" value={form.waterBodyId} onChange={(e) => setForm({ ...form, waterBodyId: e.target.value })} />
        <input placeholder="Название водоёма как в документе" value={form.waterBodyNameRaw} onChange={(e) => setForm({ ...form, waterBodyNameRaw: e.target.value })} />
        <input placeholder="Широта, если есть" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
        <input placeholder="Долгота, если есть" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
        <input placeholder="Радиус, м" value={form.radiusM} onChange={(e) => setForm({ ...form, radiusM: e.target.value })} />
        <select value={form.boundaryAccuracy} onChange={(e) => setForm({ ...form, boundaryAccuracy: e.target.value })}>
          <option value="unknown">точность неизвестна</option>
          <option value="exact">точные границы</option>
          <option value="approximate">приблизительно</option>
          <option value="radius">точка и радиус</option>
        </select>
        <input placeholder="Запрет с (ГГГГ-ММ-ДД или ММ-ДД)" value={form.banFrom} onChange={(e) => setForm({ ...form, banFrom: e.target.value })} />
        <input placeholder="Запрет по" value={form.banTo} onChange={(e) => setForm({ ...form, banTo: e.target.value })} />
        <label>
          <input type="checkbox" checked={form.isYearRound} onChange={(e) => setForm({ ...form, isYearRound: e.target.checked })} /> круглый год
        </label>
        <input placeholder="Источник" value={form.sourceTitle} onChange={(e) => setForm({ ...form, sourceTitle: e.target.value })} />
        <input placeholder="Ссылка на источник" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} />
        <input placeholder="Дата источника" value={form.sourceDate} onChange={(e) => setForm({ ...form, sourceDate: e.target.value })} />
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="needs_review">нужна проверка</option>
          <option value="active">показывать</option>
          <option value="inactive">скрыть</option>
        </select>
        <input placeholder="Примечание" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button type="submit">Добавить яму</button>
      </form>
      <label className={styles.btnSm}>
        Импорт GeoJSON
        <input
          type="file"
          accept="application/json,.geojson"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
          }}
        />
      </label>
      <ul className={styles.list}>
        {list.map((pit) => (
          <li key={pit.id} className={styles.card}>
            <strong>{pit.name}</strong> — {pit.region || 'область не указана'} — {pit.status} — {pit.boundaryAccuracy}
            {!pit.geometry && ' — контур не нанесён'}
            <button type="button" className={styles.btnSm} onClick={() => api.admin.updateWinteringPit(pit.id, { status: pit.status === 'active' ? 'inactive' : 'active' }).then(load)}>
              {pit.status === 'active' ? 'Скрыть' : 'Показывать'}
            </button>
            <button type="button" className={styles.danger} onClick={() => api.admin.deleteWinteringPit(pit.id).then(load)}>
              Удалить
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminReports() {
  const [list, setList] = useState<VisibilityReport[]>([]);
  const load = () => api.admin.visibilityReports().then(setList).catch(() => setList([]));
  useEffect(() => {
    load();
  }, []);
  return (
    <div className={styles.section}>
      <h2>Отчёты о прозрачности</h2>
      <p>Пока отчёт не одобрен, цвет водоёма на карте не меняется. Выброс относительно пяти прошлых отчётов помечен и карту не красит даже после одобрения.</p>
      <ul className={styles.list}>
        {list.map((report) => (
          <li key={report.id} className={styles.card}>
            Водоём {report.waterBodyId}, {report.observedOn}: {report.visibilityM} м, {report.waterColor || 'цвет не указан'}, {report.status}
            {report.outlier ? ' — выброс' : ''}
            {report.note ? ` — ${report.note}` : ''}
            <button type="button" className={styles.btnSm} onClick={() => api.admin.moderateReport(report.id, 'approved').then(load)}>
              Одобрить
            </button>
            <button type="button" className={styles.danger} onClick={() => api.admin.moderateReport(report.id, 'rejected').then(load)}>
              Отклонить
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminCorrections() {
  const [list, setList] = useState<CorrectionSuggestion[]>([]);
  const load = () => api.admin.corrections().then(setList).catch(() => setList([]));
  useEffect(() => {
    load();
  }, []);
  return (
    <div className={styles.section}>
      <h2>Исправления</h2>
      <ul className={styles.list}>
        {list.map((item) => (
          <li key={item.id} className={styles.card}>
            <strong>{item.suggestionType}</strong> — водоём {item.waterBodyId ?? 'не указан'} — {item.status}
            <p>{item.message}</p>
            {item.contact && <p>Контакт: {item.contact}</p>}
            <button type="button" className={styles.btnSm} onClick={() => api.admin.moderateCorrection(item.id, 'accepted').then(load)}>
              Принять
            </button>
            <button type="button" className={styles.danger} onClick={() => api.admin.moderateCorrection(item.id, 'rejected').then(load)}>
              Отклонить
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
