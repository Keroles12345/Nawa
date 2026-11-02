FROM node:22-alpine AS builder
WORKDIR /app
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ecommerce?schema=public

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ecommerce?schema=public

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY .env.example ./.env

EXPOSE 4000
CMD ["node", "dist/src/index.js"]
