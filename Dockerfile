# Stage 1: build the Vite SPA.
FROM node:24-bookworm-slim AS builder
WORKDIR /app

# Browser key for the map picker + Places search: baked into the bundle at
# build time by design (public, must be referrer-restricted in the Google
# console). Pass with: --build-arg VITE_GOOGLE_MAPS_KEY=...
ARG VITE_GOOGLE_MAPS_KEY
ENV VITE_GOOGLE_MAPS_KEY=$VITE_GOOGLE_MAPS_KEY

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
