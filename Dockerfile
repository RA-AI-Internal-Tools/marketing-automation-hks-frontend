# --- Build stage ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
# --legacy-peer-deps: openapi-typescript@7 peer-requires TS ^5.x, this
# project is on TS 6. Runtime-only codegen tool; peer mismatch doesn't
# affect the built artefact. Real fix is upstream openapi-typescript
# bumping their TS peer range.
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# --- Runtime stage: nginx serving built SPA ---
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Secure permissions + non-root nginx user
RUN chmod 644 /etc/nginx/conf.d/default.conf && \
    chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx && \
    touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid

# Validate the config we just installed. Without this the CI `docker` job
# builds green on a syntactically INVALID nginx.conf — proven by building a
# copy of this stage with `this is not valid nginx syntax at all {{{ ;;;` as
# the config: build exit 0, and `nginx -t` inside the resulting image then
# reports `[emerg] unknown directive "this"`. The job never runs the image,
# so the break would only surface when a container is started. Run as root,
# before `USER nginx`, so the test can write its temp/log paths.
#
# Safe to run at build time even though nginx.conf proxies to a backend:
# `proxy_pass $backend_api` uses a VARIABLE, so nginx defers name resolution
# to request time via the `resolver` directive and does not try (and fail) to
# resolve an upstream during the config test.
RUN nginx -t

USER nginx
CMD ["nginx", "-g", "daemon off;"]
