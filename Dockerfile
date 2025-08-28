# Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ openssl openssl-dev

WORKDIR /app

# Copy package.json files
COPY package*.json ./
COPY packages/api/package*.json ./packages/api/
COPY packages/core/package*.json ./packages/core/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/terminal/package*.json ./packages/terminal/

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install

# Copy source code
COPY . .

# Generate Prisma client
RUN cd packages/api && npx prisma generate

# Build packages (exclude desktop from server image build)
RUN pnpm -r --filter "!@rinawarp/desktop" run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and built artifacts
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/api/package*.json ./packages/api/
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=builder /app/node_modules ./node_modules

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start the application
WORKDIR /app/packages/api
CMD ["node", "dist/main.js"]
