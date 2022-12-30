# Install dependencies only when needed
FROM node:16-slim AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Rebuild the source code only when needed
FROM node:16-slim AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN yarn install --production --ignore-scripts --prefer-offline

# Production image, copy all the files and run next
FROM node:16-slim AS runner

# We don't need the standalone Chromium
ENV PORT 8080
ENV NODE_ENV production

WORKDIR /app
COPY --from=builder app/src ./src
# COPY --from=builder app/.env ./.env # only for local fly deploys
COPY --from=builder app/node_modules ./node_modules
COPY --from=builder app/package.json ./package.json

LABEL com.centurylinklabs.watchtower.enable="true"

EXPOSE 8080

CMD ["yarn", "start"]
