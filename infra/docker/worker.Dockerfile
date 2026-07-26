FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY apps apps
COPY packages packages
RUN npm ci --workspace @ciphervault/worker --include-workspace-root
RUN npm run build -w @ciphervault/worker

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S ciphervault && adduser -S -G ciphervault ciphervault
COPY --from=build --chown=ciphervault:ciphervault /app/apps/worker/dist ./dist
COPY --from=build --chown=ciphervault:ciphervault /app/packages ./packages
COPY --from=build --chown=ciphervault:ciphervault /app/node_modules ./node_modules
USER ciphervault
CMD ["node", "dist/worker.js"]
