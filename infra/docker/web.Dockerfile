FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY apps apps
COPY packages packages
COPY src/styles.css src/styles.css
RUN npm ci --workspace @ciphervault/web --include-workspace-root
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w @ciphervault/web

FROM alpine:3.21
COPY --from=build /app/apps/web/dist /dist
CMD ["sh", "-c", "cp -r /dist/. /output/"]
