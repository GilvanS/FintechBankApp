# Multi-stage build para otimizar o tamanho da imagem

# Stage 1: Build do frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Stage 2: Build do backend
FROM node:18-alpine AS backend-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --only=production
COPY server/ .
RUN npm run build

# Stage 3: Imagem final
FROM node:18-alpine AS production
WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache dumb-init

# Copiar backend compilado
COPY --from=backend-builder /app/server/dist ./server/dist
COPY --from=backend-builder /app/server/node_modules ./server/node_modules
COPY --from=backend-builder /app/server/package.json ./server/

# Copiar frontend compilado
COPY --from=frontend-builder /app/dist ./public

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3001

# Usar dumb-init para gerenciar processos
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/dist/app.js"]