FROM node:20-bookworm-slim

WORKDIR /app

# Install deps (postinstall script must exist; generate runs later in npm run build).
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci

# Full source + prisma generate via build.
COPY . .
RUN npm run build

ENV NODE_ENV=production

EXPOSE 5173

CMD ["npm", "run", "start:prod"]
