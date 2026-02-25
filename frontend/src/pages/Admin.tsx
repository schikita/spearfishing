import { useState, useEffect } from "react";
import {
  api,
  WaterBody,
  ReferenceSection,
  PermitOrganization,
  AdminUser,
} from "../api/client";
import styles from "./Admin.module.css";

type Tab = "users" | "water" | "reference" | "permit";

export default function Admin() {
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [waterBodies, setWaterBodies] = useState<WaterBody[]>([]);
  const [sections, setSections] = useState<ReferenceSection[]>([]);
  const [orgs, setOrgs] = useState<PermitOrganization[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      api.admin.users(),
      api.admin.waterBodies(),
      api.admin.reference(),
      api.admin.permitOrganizations(),
    ])
      .then(([u, w, r, o]) => {
        setUsers(u);
        setWaterBodies(w);
        setSections(r);
        setOrgs(o);
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className={styles.wrap}>
      <h1>Админ-панель</h1>
      <div className={styles.tabs}>
        {(["users", "water", "reference", "permit"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? styles.active : ""}
            onClick={() => setTab(t)}
          >
            {t === "users" && "Пользователи"}
            {t === "water" && "Водоёмы"}
            {t === "reference" && "Справочник"}
            {t === "permit" && "Организации"}
          </button>
        ))}
      </div>
      {message && <div className={styles.error}>{message}</div>}
      {loading && <div className={styles.loading}>Загрузка…</div>}
      {!loading && tab === "users" && (
        <AdminUsers users={users} onSave={load} />
      )}
      {!loading && tab === "water" && (
        <AdminWaterBodies list={waterBodies} onSave={load} />
      )}
      {!loading && tab === "reference" && (
        <AdminReference list={sections} onSave={load} />
      )}
      {!loading && tab === "permit" && (
        <AdminPermitOrgs list={orgs} onSave={load} />
      )}
    </div>
  );
}

function AdminUsers({
  users: list,
  onSave,
}: {
  users: AdminUser[];
  onSave: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [allowedIp, setAllowedIp] = useState("");
  const [editingIp, setEditingIp] = useState<number | null>(null);
  const [ipValue, setIpValue] = useState("");

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.admin.createUser({
        email,
        password,
        allowedIp: allowedIp || undefined,
      });
      setEmail("");
      setPassword("");
      setAllowedIp("");
      onSave();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    }
  };

  const updateIp = async (id: number) => {
    try {
      await api.admin.updateUser(id, { allowedIp: ipValue });
      setEditingIp(null);
      onSave();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    }
  };

  return (
    <div className={styles.section}>
      <h2>Добавить пользователя</h2>
      <form onSubmit={createUser} className={styles.form}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          placeholder="IP (опционально, один доступ — один IP)"
          value={allowedIp}
          onChange={(e) => setAllowedIp(e.target.value)}
        />
        <button type="submit">Создать</button>
      </form>
      <h2>Список пользователей</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Email</th>
            <th>Роль</th>
            <th>Привязанный IP</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>
                {editingIp === u.id ? (
                  <>
                    <input
                      value={ipValue}
                      onChange={(e) => setIpValue(e.target.value)}
                      placeholder="IP"
                      className={styles.inputSm}
                    />
                    <button type="button" onClick={() => updateIp(u.id)}>
                      Сохранить
                    </button>
                    <button type="button" onClick={() => setEditingIp(null)}>
                      Отмена
                    </button>
                  </>
                ) : (
                  <>
                    {u.allowedIp || "—"}
                    <button
                      type="button"
                      className={styles.btnSm}
                      onClick={() => {
                        setEditingIp(u.id);
                        setIpValue(u.allowedIp || "");
                      }}
                    >
                      Изменить
                    </button>
                  </>
                )}
              </td>
              <td>
                {u.role !== "admin" && (
                  <button
                    type="button"
                    className={styles.danger}
                    onClick={async () => {
                      if (confirm("Удалить?")) await api.admin.deleteUser(u.id);
                      onSave();
                    }}
                  >
                    Удалить
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminWaterBodies({
  list,
  onSave,
}: {
  list: WaterBody[];
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    nameRu: "",
    region: "",
    description: "",
    lat: "",
    lng: "",
    permitInfo: "",
  });
  const [editing, setEditing] = useState<WaterBody | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.admin.updateWaterBody(editing.id, form);
        setEditing(null);
      } else {
        await api.admin.createWaterBody(form);
      }
      setForm({
        name: "",
        nameRu: "",
        region: "",
        description: "",
        lat: "",
        lng: "",
        permitInfo: "",
      });
      onSave();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    }
  };

  return (
    <div className={styles.section}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ margin: 0 }}>
          {editing ? "Редактировать водоём" : "Добавить водоём"}
        </h2>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || list.length === 0}
          className={styles.btnSm}
        >
          {exporting ? "Экспорт…" : "📥 Экспорт GeoJSON"}
        </button>
      </div>
      <form onSubmit={submit} className={styles.formGrid}>
        <input
          placeholder="Название"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <input
          placeholder="Название (RU)"
          value={form.nameRu}
          onChange={(e) => setForm((f) => ({ ...f, nameRu: e.target.value }))}
        />
        <input
          placeholder="Регион"
          value={form.region}
          onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
          required
        />
        <input
          placeholder="Широта"
          value={form.lat}
          onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
          required
        />
        <input
          placeholder="Долгота"
          value={form.lng}
          onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
          required
        />
        <input
          placeholder="Описание"
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
        />
        <input
          placeholder="Инфо о путёвке"
          value={form.permitInfo}
          onChange={(e) =>
            setForm((f) => ({ ...f, permitInfo: e.target.value }))
          }
        />
        <button type="submit">{editing ? "Сохранить" : "Добавить"}</button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm({
                name: "",
                nameRu: "",
                region: "",
                description: "",
                lat: "",
                lng: "",
                permitInfo: "",
              });
            }}
          >
            Отмена
          </button>
        )}
      </form>
      <ul className={styles.list}>
        {list.map((wb) => (
          <li key={wb.id} className={styles.card}>
            <strong>{wb.nameRu || wb.name}</strong> — {wb.region} ({wb.lat},{" "}
            {wb.lng})
            <button
              type="button"
              className={styles.btnSm}
              onClick={() => {
                setEditing(wb);
                setForm({
                  name: wb.name,
                  nameRu: wb.nameRu || "",
                  region: wb.region,
                  description: wb.description || "",
                  lat: wb.lat,
                  lng: wb.lng,
                  permitInfo: wb.permitInfo || "",
                });
              }}
            >
              Изменить
            </button>
            <button
              type="button"
              className={styles.danger}
              onClick={async () => {
                if (confirm("Удалить?")) await api.admin.deleteWaterBody(wb.id);
                onSave();
              }}
            >
              Удалить
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdminReference({
  list,
  onSave,
}: {
  list: ReferenceSection[];
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    slug: "",
    title: "",
    titleRu: "",
    content: "",
  });
  const [editing, setEditing] = useState<ReferenceSection | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.admin.updateReference(editing.id, form);
        setEditing(null);
      } else {
        await api.admin.createReference(form);
      }
      setForm({ slug: "", title: "", titleRu: "", content: "" });
      onSave();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    }
  };

  return (
    <div className={styles.section}>
      <h2>{editing ? "Редактировать раздел" : "Добавить раздел"}</h2>
      <form onSubmit={submit} className={styles.formGrid}>
        <input
          placeholder="Slug"
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          required
        />
        <input
          placeholder="Заголовок"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          required
        />
        <input
          placeholder="Заголовок RU"
          value={form.titleRu}
          onChange={(e) => setForm((f) => ({ ...f, titleRu: e.target.value }))}
        />
        <textarea
          placeholder="Контент (Markdown)"
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          rows={6}
          required
        />
        <button type="submit">{editing ? "Сохранить" : "Добавить"}</button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm({ slug: "", title: "", titleRu: "", content: "" });
            }}
          >
            Отмена
          </button>
        )}
      </form>
      <ul className={styles.list}>
        {list.map((s) => (
          <li key={s.id} className={styles.card}>
            <strong>{s.titleRu || s.title}</strong> ({s.slug})
            <button
              type="button"
              className={styles.btnSm}
              onClick={() => {
                setEditing(s);
                setForm({
                  slug: s.slug,
                  title: s.title,
                  titleRu: s.titleRu || "",
                  content: s.content,
                });
              }}
            >
              Изменить
            </button>
            <button
              type="button"
              className={styles.danger}
              onClick={async () => {
                if (confirm("Удалить?")) await api.admin.deleteReference(s.id);
                onSave();
              }}
            >
              Удалить
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdminPermitOrgs({
  list,
  onSave,
}: {
  list: PermitOrganization[];
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    nameRu: "",
    region: "",
    description: "",
    url: "",
    phone: "",
    address: "",
  });
  const [editing, setEditing] = useState<PermitOrganization | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.admin.updatePermitOrg(editing.id, form);
        setEditing(null);
      } else {
        await api.admin.createPermitOrg(form);
      }
      setForm({
        name: "",
        nameRu: "",
        region: "",
        description: "",
        url: "",
        phone: "",
        address: "",
      });
      onSave();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    }
  };

  return (
    <div className={styles.section}>
      <h2>{editing ? "Редактировать организацию" : "Добавить организацию"}</h2>
      <form onSubmit={submit} className={styles.formGrid}>
        <input
          placeholder="Название"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <input
          placeholder="Регион"
          value={form.region}
          onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
          required
        />
        <input
          placeholder="Описание"
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
        />
        <input
          placeholder="URL"
          value={form.url}
          onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
        />
        <input
          placeholder="Телефон"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />
        <input
          placeholder="Адрес"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />
        <button type="submit">{editing ? "Сохранить" : "Добавить"}</button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm({
                name: "",
                nameRu: "",
                region: "",
                description: "",
                url: "",
                phone: "",
                address: "",
              });
            }}
          >
            Отмена
          </button>
        )}
      </form>
      <ul className={styles.list}>
        {list.map((o) => (
          <li key={o.id} className={styles.card}>
            <strong>{o.nameRu || o.name}</strong> — {o.region}{" "}
            {o.url && (
              <a href={o.url} target="_blank" rel="noopener noreferrer">
                Сайт
              </a>
            )}
            <button
              type="button"
              className={styles.btnSm}
              onClick={() => {
                setEditing(o);
                setForm({
                  name: o.name,
                  nameRu: o.nameRu || "",
                  region: o.region,
                  description: o.description || "",
                  url: o.url || "",
                  phone: o.phone || "",
                  address: o.address || "",
                });
              }}
            >
              Изменить
            </button>
            <button
              type="button"
              className={styles.danger}
              onClick={async () => {
                if (confirm("Удалить?")) await api.admin.deletePermitOrg(o.id);
                onSave();
              }}
            >
              Удалить
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
