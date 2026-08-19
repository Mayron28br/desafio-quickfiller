# Stage 1: Build do Front-end
FROM node:22-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build do Back-end
FROM node:22-slim AS backend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src/ ./src
RUN npm run build:backend

# Stage 3: Imagem de Produção
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Instala apenas dependências de produção do backend
COPY package*.json ./
RUN npm install --omit=dev

# Copia build do backend e frontend
COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 3000

CMD ["node", "dist/server.js"]

