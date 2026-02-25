# Подводная охота — Беларусь

Сервис-справочник разрешённых водоёмов для подводной охоты в Беларуси: карта с маршрутами, справочная информация, контакты организаций (БООР и др.), авторизация с привязкой доступа по IP.

## Возможности

- **Карта** — водоёмы с разрешённой подводной охотой (Leaflet/OSM), геолокация, построение маршрута от текущего местоположения до выбранного водоёма (OSRM).
- **Справочник** — экипировка, правила, полезная информация.
- **Разрешения** — контакты организаций, выдающих путёвки (ссылки на [БООР Брест](https://rgooboor.by/fishing/15?type=8), [БООР Гомель](https://rgooboor.by/fishing/26?type=8) и др.).
- **Авторизация** — JWT, один доступ = один IP (админ задаёт пользователю привязанный IP).
- **Админка** — пользователи (создание, привязка IP), водоёмы, разделы справочника, организации.

## Стек

- Backend: Node.js, Express, TypeScript, SQLite (Drizzle ORM), JWT, bcrypt.
- Frontend: React, Vite, TypeScript, React Router, Leaflet.
- Развёртывание: Docker.

## Локальный запуск (два терминала)

Сейчас проект настроен на запуск **локально**: бэкенд и фронтенд в двух отдельных терминалах.

**1. Установка зависимостей (один раз)**

```bash
# из корня проекта
npm install
```

(Устанавливаются зависимости корня, `backend` и `frontend` за счёт `postinstall`.)

Если установка падает при сборке **better-sqlite3** с ошибкой `SELF_SIGNED_CERT_IN_CHAIN` (корпоративный прокси/сертификат), перед установкой временно отключите проверку SSL и повторите:

```powershell
# PowerShell (только на время установки)
$env:NODE_TLS_REJECT_UNAUTHORIZED=0
npm install
```

После установки можно снова не задавать переменную (или поставить `1`). Для постоянной работы за прокси лучше настроить корпоративный CA в системе или в npm.

**2. Переменные для бэкенда**

В папке `backend` создайте файл `.env` (можно скопировать из корневого `.env.example`):

```bash
# backend/.env
PORT=3000
JWT_SECRET=change-me-min-32-chars
SQLITE_PATH=./data/spearfishing.db
ADMIN_EMAIL=admin@spearfishing.by
ADMIN_PASSWORD=admin123
```

**3. (Опционально) Загрузка водоёмов из GeoJSON**

В корне проекта лежат файлы **`brest_waterbodies.geojson`** и **`minsk_waterbodies.geojson`**. Чтобы подставить их в БД:

```bash
cd backend
npm run db:seed-waterbodies
```

Скрипт очищает таблицу водоёмов и заполняет её из GeoJSON. По умолчанию загружаются `brest_waterbodies.geojson` и `minsk_waterbodies.geojson`. Иначе задайте `WATERBODIES_GEOJSON=/путь/1.geojson,/путь/2.geojson`.

**4. Два терминала**

**Терминал 1 — бэкенд:**

```bash
cd backend
npm run dev
```

Сервер запустится на http://localhost:3000. При первом запуске создастся БД SQLite и начальные данные (админ, справочник, организации БООР).

**Терминал 2 — фронтенд:**

```bash
cd frontend
npm run dev
```

Откройте в браузере: **http://localhost:5173**. Фронт по умолчанию ходит за API на `http://localhost:3000`. Если бэкенд на другом порту, создайте `frontend/.env` с `VITE_API_URL=http://localhost:ВАШ_ПОРТ`.

Вход: **admin@spearfishing.by** / **admin123**.

---

## Запуск через Docker

```bash
docker-compose up -d --build
# Сервис: http://localhost:3000
# Вход: admin@spearfishing.by / admin123
```

Переменные в `.env` или в `docker-compose`: `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Данные SQLite — в volume `app-data`. За прокси передавайте реальный IP в `X-Forwarded-For`.

## Деплой на Vercel (всё в одном проекте)

Чтобы приложение само поднялось при деплое на Vercel (фронт + API):

1. **Подключите базу Postgres в Vercel**  
   В проекте на [vercel.com](https://vercel.com): **Storage** → **Create Database** → **Postgres** → создайте БД и подключите к проекту. В проект автоматически добавятся переменные `POSTGRES_URL` и др.

2. **Деплой**  
   Сделайте push в репозиторий или **Redeploy** в Vercel. Сборка запустит бэкенд и фронт; API будет доступен по `/api/*`, статика — с корня.

3. **Первый вход**  
   Логин: `admin@spearfishing.by`, пароль: `admin123` (или значения из переменных `ADMIN_EMAIL` и `ADMIN_PASSWORD`).

Без подключённого Postgres запросы к `/api/*` будут падать с ошибкой. Локально и в Docker по-прежнему используется SQLite (переменная `POSTGRES_URL` не задаётся).

## Деплой: фронт на Vercel + бэкенд на Railway

Если фронт уже на Vercel (например `spearfishing-coral.vercel.app`), а запросы к `/api/*` дают 404:

1. **Разверните бэкенд на Railway**  
   - Зайдите на [railway.app](https://railway.app), New Project → Deploy from GitHub → выберите репозиторий.  
   - В настройках сервиса задайте: **Root Directory** — `backend` (только бэкенд), **Build Command** — `npm install && npm run build`, **Start Command** — `node dist/index.js`.  
   - В **Variables** добавьте `JWT_SECRET` (обязательно), при необходимости `ADMIN_EMAIL` и `ADMIN_PASSWORD`.  
   - Сохраните и дождитесь деплоя. В разделе **Settings** → **Networking** включите **Generate Domain** и скопируйте URL (например `https://spearfishing-production.up.railway.app`).

2. **Укажите этот URL во фронте на Vercel**  
   - Vercel → ваш проект → **Settings** → **Environment Variables**.  
   - Добавьте переменную: **Name** — `VITE_API_URL`, **Value** — `https://ваш-бэкенд.up.railway.app` (без слэша в конце).  
   - Сохраните и сделайте **Redeploy** (Deployments → … → Redeploy). Переменные Vite подставляются при сборке, поэтому без редеплоя 404 не исчезнет.

После редеплоя фронт будет ходить за данными на бэкенд с Railway, 404 по `/api/*` пропадут.

## Развёртывание на сервере (не Vercel)

Сервис — один Node-сервер с статикой и API, без serverless. Варианты:

1. **Свой сервер (VPS)** — установить Docker, склонировать репозиторий, задать `.env` и выполнить `docker-compose up -d --build`. Рекомендуется обратный прокси (Nginx/Caddy) с HTTPS.
2. **Railway / Render / Fly.io** — поддерживают Docker и стабильно работают с кириллицей и любыми локалями. Развернуть через Dockerfile или указать `docker-compose` (где доступно).
3. **Vercel** — подходит только фронтенд; бэкенд с SQLite и долгими сессиями лучше размещать отдельно (тот же VPS/Railway/Render).

Итог: для полного приложения с БД и привязкой по IP удобнее всего **Docker на VPS** или **Railway/Render** с Docker.

## Структура

- `backend/` — API, миграции, сид, админ-роуты.
- `frontend/` — SPA (главная, карта, справочник, контакты, вход, админка).
- `Dockerfile` — сборка фронта + бэкенд, отдача статики из Express.
