# Stage 1: build the Vite SPA.
FROM node:24-bookworm-slim AS builder
WORKDIR /app

# The maps browser key bakes in from the tracked .env.production, which vite
# loads in production mode. Deliberately NO ARG/ENV for it here: a real env
# var beats env files in vite, so even an empty VITE_GOOGLE_MAPS_KEY would
# shadow .env.production and silently strip the map picker and place search
# from the bundle (this is exactly how the 2026-09-21 :main image broke).

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: serve the static bundle and proxy the API paths.
FROM nginx:1.27-alpine

# Dist lands under the /aubounty/ mount the vite base and nginx.conf expect.
COPY --from=builder /app/dist /usr/share/nginx/html/aubounty
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
