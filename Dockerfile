FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/index.js"]
