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

USER nginx
CMD ["nginx", "-g", "daemon off;"]
