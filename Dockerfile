# Container image for the application itself.
#
# Not needed for Vercel — this is for hosts that take an image (Fly, Cloud Run,
# a self-managed box). The build never contacts the database: every
# database-backed route is dynamic, so no page is prerendered and no credential
# is required at build time.
#
#   docker build -t understory .
#   docker run --rm -p 3000:3000 --env-file .env.local understory

# ---- dependencies ------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build -------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- run ---------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=build /app/public ./public
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

USER nextjs
EXPOSE 3000
CMD ["npm", "start"]
