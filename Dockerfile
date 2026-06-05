FROM node:20-bookworm-slim

WORKDIR /app

# Install deps (postinstall skips generate until schema exists).
COPY package.json package-lock.json ./
RUN npm ci

# Full source + prisma generate via build.
COPY . .
RUN npm run build

ENV NODE_ENV=production

EXPOSE 5173

CMD ["npm", "run", "start:prod"]
