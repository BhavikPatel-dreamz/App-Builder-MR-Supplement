FROM node:22-alpine AS base
RUN npm install -g pnpm
RUN apk add --no-cache openssl libc6-compat

# --- deps ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile

# --- builder ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN PRISMA_HIDE_UPDATE_MESSAGE=1 npx prisma generate
RUN pnpm build:ci

# --- runner ---
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV PRISMA_HIDE_UPDATE_MESSAGE=1

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["sh", "-c", "PRISMA_HIDE_UPDATE_MESSAGE=1 npx prisma migrate deploy && npx react-router-serve ./build/server/index.js"]
