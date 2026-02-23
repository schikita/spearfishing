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

## Запуск через Docker (рекомендуется)

```bash
# Сборка и запуск
docker-compose up -d --build

# Сервис: http://localhost:3000
# Первый вход: admin@spearfishing.by / admin123 (смените пароль и задайте JWT_SECRET в .env)
```

Переменные окружения (в `.env` или в `docker-compose`):

- `JWT_SECRET` — секрет для JWT (обязательно смените в продакшене).
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — логин/пароль первого админа (при первом запуске).

Данные SQLite хранятся в volume `app-data`. При первом запуске таблицы и начальные данные (админ, справочник, организации БООР) создаются автоматически.

**Важно:** если сервис стоит за Nginx или другим прокси, передавайте реальный IP клиента в заголовке `X-Forwarded-For`, иначе привязка «один доступ — один IP» будет работать по IP прокси.

## Локальная разработка

```bash
# Корень проекта
npm install
cd backend && npm install && npm run build && node dist/db/migrate.js && node dist/db/seed.js
cd ../frontend && npm install

# В двух терминалах:
# 1) backend
cd backend && npm run dev
# 2) frontend (прокси /api -> localhost:3000)
cd frontend && npm run dev
```

Фронт: http://localhost:5173, API: http://localhost:3000.

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
