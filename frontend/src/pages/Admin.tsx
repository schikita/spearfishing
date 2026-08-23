import { useState, useEffect } from "react";
import {
  api,
  API_BASE,
  WaterBody,
  ReferenceSection,
  BlogPost,
  PermitOrganization,
  AdminUser,
} from "../api/client";
import styles from "./Admin.module.css";

type Tab = "users" | "water" | "reference" | "blog" | "permit" | "settings";

export default function Admin() {
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [waterBodies, setWaterBodies] = useState<WaterBody[]>([]);
  const [sections, setSections] = useState<ReferenceSection[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [orgs, setOrgs] = useState<PermitOrganization[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      api.admin.users(),
      api.admin.waterBodies(),
      api.admin.reference(),
      api.admin.blog(),
      api.admin.permitOrganizations(),
    ])
      .then(([u, w, r, b, o]) => {
        setUsers(u);
        setWaterBodies(w);
        setSections(r);
        setPosts(b);
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
        {(["users", "water", "reference", "blog", "permit", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? styles.active : ""}
            onClick={() => setTab(t)}
          >
            {t === "users" && "Пользователи"}
            {t === "water" && "Водоёмы"}
            {t === "reference" && "Справочник"}
            {t === "blog" && "Блог"}
            {t === "permit" && "Организации"}
            {t === "settings" && "Настройки"}
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
      {!loading && tab === "blog" && (
        <AdminBlog list={posts} onSave={load} />
      )}
      {!loading && tab === "permit" && (
        <AdminPermitOrgs list={orgs} onSave={load} />
      )}
      {tab === "settings" && <AdminSettings />}
    </div>
  );
}

const PAGE_BG_LABELS: Record<string, string> = {
  home: "Главная",
  map: "Карта",
  reference: "Справочник",
  blog: "Блог",
  contacts: "Разрешения",
  info: "Справочная информация",
};

function PageInfoEdit({
  pageKey,
  label,
  initialTitle,
  initialIntro,
  onSaved,
  saving,
  setSaving,
}: {
  pageKey: string;
  label: string;
  initialTitle: string;
  initialIntro: string;
  onSaved: () => void;
  saving: boolean;
  setSaving: (v: string | null) => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [intro, setIntro] = useState(initialIntro);
  useEffect(() => {
    setTitle(initialTitle);
    setIntro(initialIntro);
  }, [initialTitle, initialIntro]);

  const save = async () => {
    setSaving(pageKey);
    try {
      await api.admin.updatePageInfo(pageKey, { title, intro });
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>{label}</h3>
      <div className={styles.formGrid} style={{ flexDirection: "column", alignItems: "stretch" }}>
        <label>
          Заголовок
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок страницы"
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
        </label>
        <label>
          Вступительный текст
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="Вступительный текст"
            rows={3}
            style={{ width: "100%", marginTop: "0.25rem", resize: "vertical" }}
          />
        </label>
        <button type="button" onClick={save} disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}

function PageInfoEditWithContacts({
  pageKey,
  label,
  initialTitle,
  initialIntro,
  initialPhone,
  initialEmail,
  onSaved,
  saving,
  setSaving,
}: {
  pageKey: string;
  label: string;
  initialTitle: string;
  initialIntro: string;
  initialPhone: string;
  initialEmail: string;
  onSaved: () => void;
  saving: boolean;
  setSaving: (v: string | null) => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [intro, setIntro] = useState(initialIntro);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  useEffect(() => {
    setTitle(initialTitle);
    setIntro(initialIntro);
    setPhone(initialPhone);
    setEmail(initialEmail);
  }, [initialTitle, initialIntro, initialPhone, initialEmail]);

  const save = async () => {
    setSaving(pageKey);
    try {
      await api.admin.updatePageInfo(pageKey, { title, intro, phone, email });
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>{label}</h3>
      <div className={styles.formGrid} style={{ flexDirection: "column", alignItems: "stretch" }}>
        <label>
          Заголовок
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок страницы"
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
        </label>
        <label>
          Вступительный текст
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="Вступительный текст"
            rows={3}
            style={{ width: "100%", marginTop: "0.25rem", resize: "vertical" }}
          />
        </label>
        <label>
          Телефон
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+375 29 123-45-67"
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="info@example.by"
            style={{ width: "100%", marginTop: "0.25rem" }}
          />
        </label>
        <button type="button" onClick={save} disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}

function AdminSettings() {
  const [authBgUrl, setAuthBgUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [pageBgUrls, setPageBgUrls] = useState<Record<string, string | null>>({});
  const [pageInfo, setPageInfo] = useState<Record<string, { title: string; intro: string; phone?: string; email?: string }>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [savingPageInfo, setSavingPageInfo] = useState<string | null>(null);

  const loadAll = () => {
    api.admin.authBg().then((r) => setAuthBgUrl(r.url)).catch(() => {});
    api.admin.logo().then((r) => setLogoUrl(r.url)).catch(() => {});
    api.admin.favicon().then((r) => setFaviconUrl(r.url)).catch(() => {});
    Promise.all(
      Object.keys(PAGE_BG_LABELS).map((k) =>
        api.admin.pageBg(k).then((r) => ({ k, url: r.url }))
      )
    ).then((results) => {
      const urls: Record<string, string | null> = {};
      results.forEach(({ k, url }) => { urls[k] = url; });
      setPageBgUrls(urls);
    }).catch(() => {});
    api.admin.pageInfo().then(setPageInfo).catch(() => {});
  };

  useEffect(() => {
    loadAll();
  }, []);

  const uploadBlock = (
    label: string,
    key: string,
    url: string | null,
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void,
    onDelete: () => void,
    accept: string,
    hint: string
  ) => (
    <div className={styles.section} key={key}>
      <h2>{label}</h2>
      <p className={styles.muted}>{hint}</p>
      {url && (
        <div className={styles.authBgPreview}>
          <img src={(API_BASE || "") + url} alt={label} style={{ maxHeight: key === "favicon" ? 48 : 200 }} />
          <button
            type="button"
            className={styles.danger}
            onClick={onDelete}
            disabled={deleting === key}
          >
            {deleting === key ? "Удаление…" : "Удалить"}
          </button>
        </div>
      )}
      <div className={styles.form}>
        <label className={styles.uploadLabel}>
          <input
            type="file"
            accept={accept}
            onChange={onUpload}
            disabled={uploading === key}
            style={{ display: "none" }}
          />
          <span className={styles.uploadBtn}>
            {uploading === key ? "Загрузка…" : url ? "Заменить" : "Загрузить"}
          </span>
        </label>
      </div>
    </div>
  );

  return (
    <>
      {uploadBlock(
        "Фон страницы входа / регистрации",
        "authBg",
        authBgUrl,
        async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setUploading("authBg");
          try {
            await api.admin.uploadAuthBg(file);
            loadAll();
          } catch (err) {
            alert(err instanceof Error ? err.message : "Ошибка загрузки");
          } finally {
            setUploading(null);
            e.target.value = "";
          }
        },
        async () => {
          if (!confirm("Удалить фон?")) return;
          setDeleting("authBg");
          try {
            await api.admin.deleteAuthBg();
            setAuthBgUrl(null);
          } catch (err) {
            alert(err instanceof Error ? err.message : "Ошибка");
          } finally {
            setDeleting(null);
          }
        },
        "image/jpeg,image/png,image/webp",
        "JPG, PNG, WebP, до 5 МБ. Затемнение 50%."
      )}
      {uploadBlock(
        "Логотип приложения",
        "logo",
        logoUrl,
        async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setUploading("logo");
          try {
            await api.admin.uploadLogo(file);
            loadAll();
          } catch (err) {
            alert(err instanceof Error ? err.message : "Ошибка загрузки");
          } finally {
            setUploading(null);
            e.target.value = "";
          }
        },
        async () => {
          if (!confirm("Удалить логотип?")) return;
          setDeleting("logo");
          try {
            await api.admin.deleteLogo();
            setLogoUrl(null);
          } catch (err) {
            alert(err instanceof Error ? err.message : "Ошибка");
          } finally {
            setDeleting(null);
          }
        },
        "image/jpeg,image/png,image/webp,image/svg+xml",
        "Слева: картинка. Справа: «Подводная охота» и «БЕЛАРУСЬ»."
      )}
      {uploadBlock(
        "Фавиконка",
        "favicon",
        faviconUrl,
        async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setUploading("favicon");
          try {
            await api.admin.uploadFavicon(file);
            loadAll();
          } catch (err) {
            alert(err instanceof Error ? err.message : "Ошибка загрузки");
          } finally {
            setUploading(null);
            e.target.value = "";
          }
        },
        async () => {
          if (!confirm("Удалить фавиконку?")) return;
          setDeleting("favicon");
          try {
            await api.admin.deleteFavicon();
            setFaviconUrl(null);
          } catch (err) {
            alert(err instanceof Error ? err.message : "Ошибка");
          } finally {
            setDeleting(null);
          }
        },
        "image/x-icon,image/png,image/svg+xml",
        "ICO, PNG или SVG, до 512 КБ."
      )}
      <div className={styles.section}>
        <h2>Фоны страниц</h2>
        <p className={styles.muted}>
          Загрузите фон для главной, карты, справочника и разрешений. JPG, PNG, WebP, до 5 МБ.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
          {Object.entries(PAGE_BG_LABELS).map(([key, label]) =>
            uploadBlock(
              label,
              `pageBg-${key}`,
              pageBgUrls[key] ?? null,
              async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(`pageBg-${key}`);
                try {
                  await api.admin.uploadPageBg(key, file);
                  loadAll();
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Ошибка загрузки");
                } finally {
                  setUploading(null);
                  e.target.value = "";
                }
              },
              async () => {
                if (!confirm(`Удалить фон страницы «${label}»?`)) return;
                setDeleting(`pageBg-${key}`);
                try {
                  await api.admin.deletePageBg(key);
                  setPageBgUrls((prev) => ({ ...prev, [key]: null }));
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Ошибка");
                } finally {
                  setDeleting(null);
                }
              },
              "image/jpeg,image/png,image/webp",
              ""
            )
          )}
        </div>
      </div>
      <div className={styles.section}>
        <h2>Информация на справочных страницах</h2>
        <p className={styles.muted}>
          Заголовок и вступительный текст для страниц «Справочник», «Разрешения» и «Справочная информация».
        </p>
        {(["reference", "blog", "contacts"] as const).map((pageKey) => {
          const info = pageInfo[pageKey] ?? { title: "", intro: "" };
          return (
            <PageInfoEdit
              key={pageKey}
              pageKey={pageKey}
              label={PAGE_BG_LABELS[pageKey]}
              initialTitle={info.title}
              initialIntro={info.intro}
              onSaved={loadAll}
              saving={savingPageInfo === pageKey}
              setSaving={setSavingPageInfo}
            />
          );
        })}
        <PageInfoEditWithContacts
          pageKey="info"
          label={PAGE_BG_LABELS.info}
          initialTitle={pageInfo.info?.title ?? ""}
          initialIntro={pageInfo.info?.intro ?? ""}
          initialPhone={pageInfo.info?.phone ?? ""}
          initialEmail={pageInfo.info?.email ?? ""}
          onSaved={loadAll}
          saving={savingPageInfo === "info"}
          setSaving={setSavingPageInfo}
        />
      </div>
    </>
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
  const [hasAccess, setHasAccess] = useState(false);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.admin.createUser({
        email,
        password,
        hasAccess,
      });
      setEmail("");
      setPassword("");
      setHasAccess(false);
      onSave();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    }
  };

  const toggleAccess = async (id: number, current: number) => {
    try {
      await api.admin.updateUser(id, { hasAccess: !current });
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
        <label>
          <input type="checkbox" checked={hasAccess} onChange={(e) => setHasAccess(e.target.checked)} />
          Доступ к карте
        </label>
        <button type="submit">Создать</button>
      </form>
      <h2>Список пользователей</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Email</th>
            <th>Роль</th>
            <th>Доступ к карте</th>
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
                {u.role !== "admin" ? (
                  <button
                    type="button"
                    className={u.hasAccess ? styles.accessOk : ""}
                    onClick={() => toggleAccess(u.id, u.hasAccess ?? 0)}
                    title={u.hasAccess ? "Отозвать доступ" : "Выдать доступ"}
                  >
                    {u.hasAccess ? "✓ Да" : "Нет"}
                  </button>
                ) : (
                  "—"
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
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    setExporting(true);
    try {
      const features = list.map((wb) => {
        const lat = parseFloat(wb.lat);
        const lng = parseFloat(wb.lng);
        let geometry: { type: string; coordinates: unknown } = { type: "Point", coordinates: [lng, lat] };
        if (wb.geometry) {
          try {
            const g = JSON.parse(wb.geometry);
            if (g.type && g.coordinates) geometry = g;
          } catch {
            /* use point */
          }
        }
        return {
          type: "Feature" as const,
          properties: {
            id: wb.id,
            name: wb.name,
            nameRu: wb.nameRu,
            region: wb.region,
            description: wb.description,
            permitInfo: wb.permitInfo,
          },
          geometry,
        };
      });
      const geojson = {
        type: "FeatureCollection" as const,
        features,
      };
      const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "water-bodies.geojson";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка экспорта");
    } finally {
      setExporting(false);
    }
  };

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

function AdminBlog({
  list,
  onSave,
}: {
  list: BlogPost[];
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    slug: "",
    title: "",
    titleRu: "",
    excerpt: "",
    content: "",
  });
  const [editing, setEditing] = useState<BlogPost | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.admin.updateBlog(editing.id, form);
        setEditing(null);
      } else {
        await api.admin.createBlog(form);
      }
      setForm({ slug: "", title: "", titleRu: "", excerpt: "", content: "" });
      onSave();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка");
    }
  };

  return (
    <div className={styles.section}>
      <h2>{editing ? "Редактировать статью" : "Добавить статью"}</h2>
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
        <input
          placeholder="Краткое описание (excerpt)"
          value={form.excerpt}
          onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
        />
        <textarea
          placeholder="Контент (Markdown)"
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          rows={10}
          required
        />
        <button type="submit">{editing ? "Сохранить" : "Добавить"}</button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm({ slug: "", title: "", titleRu: "", excerpt: "", content: "" });
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
                  excerpt: s.excerpt || "",
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
                if (confirm("Удалить?")) await api.admin.deleteBlog(s.id);
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
