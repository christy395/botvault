# BotVault web application container (Node.js / Next.js)
# This runs the web app; it does not provide isolated Discord bot workers.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
# package-lock.json is optional in this repository, so install from package.json.
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder /app ./
EXPOSE 3000
CMD ["./node_modules/.bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
