# Stage 1: build frontend
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: backend + static
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
RUN npm run build
COPY --from=frontend /app/frontend/dist ./public
ENV NODE_ENV=production
EXPOSE 3000
RUN mkdir -p /app/data
ENV SQLITE_PATH=/app/data/spearfishing.db
CMD ["node", "dist/index.js"]
