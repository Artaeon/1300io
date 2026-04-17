# syntax=docker/dockerfile:1.7

# ---- build stage ----
FROM node:22-alpine AS build

RUN apk add --no-cache openssl

WORKDIR /app

# Install all deps (incl. dev) for typescript build + prisma generate
COPY package*.json tsconfig.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

# Source
COPY . .
RUN npm run build

# Strip to prod deps for the runtime image
RUN npm prune --omit=dev

# ---- runtime stage ----
FROM node:22-alpine AS runtime

RUN apk add --no-cache openssl tini

WORKDIR /app

# Runtime needs: compiled dist/, prunned node_modules, prisma client + migrations,
# package.json for npx to find prisma, and the uploads dir.
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

RUN mkdir -p /data/uploads && chown -R node:node /app /data

USER node

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
