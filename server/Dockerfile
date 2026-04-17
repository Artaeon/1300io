FROM node:22-alpine

RUN apk add --no-cache openssl tini

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npx prisma generate

# Drop privileges
RUN mkdir -p /data/uploads && chown -R node:node /app /data
USER node

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
