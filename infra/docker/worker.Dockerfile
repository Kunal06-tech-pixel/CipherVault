FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY apps apps
COPY packages packages
RUN npm ci --workspace @keywall/worker --include-workspace-root
RUN npm run build -w @keywall/worker

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S keywall && adduser -S -G keywall keywall
COPY --from=build --chown=keywall:keywall /app/apps/worker/dist ./dist
COPY --from=build --chown=keywall:keywall /app/packages ./packages
COPY --from=build --chown=keywall:keywall /app/node_modules ./node_modules
USER keywall
CMD ["node", "dist/worker.js"]
