FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package*.json tsconfig.base.json ./
COPY apps apps
COPY packages packages
RUN npm ci --workspace @ciphervault/api --include-workspace-root
RUN npm run build -w @ciphervault/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S ciphervault && adduser -S -G ciphervault ciphervault
COPY --from=build --chown=ciphervault:ciphervault /app/apps/api/dist ./dist
COPY --from=build --chown=ciphervault:ciphervault /app/apps/api/migrations ./migrations
COPY --from=build --chown=ciphervault:ciphervault /app/node_modules ./node_modules
USER ciphervault
EXPOSE 3001
CMD ["node", "dist/server.js"]
