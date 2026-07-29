FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package*.json tsconfig.base.json ./
COPY apps apps
COPY packages packages
RUN npm ci --workspace @keywall/api --include-workspace-root
RUN npm run build -w @keywall/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S keywall && adduser -S -G keywall keywall
COPY --from=build --chown=keywall:keywall /app/apps/api/dist ./dist
COPY --from=build --chown=keywall:keywall /app/apps/api/migrations ./migrations
COPY --from=build --chown=keywall:keywall /app/packages ./packages
COPY --from=build --chown=keywall:keywall /app/node_modules ./node_modules
USER keywall
EXPOSE 3001
CMD ["node", "dist/server.js"]
