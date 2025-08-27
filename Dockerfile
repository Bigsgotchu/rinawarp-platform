FROM node:18-alpine AS builder

WORKDIR /app

# Install OpenSSL and other required build dependencies
RUN apk add --no-cache openssl openssl-dev python3 make g++ curl

# Copy package files and install dependencies
COPY package*.json ./
COPY packages/*/package*.json ./packages/
RUN npm ci

# Copy prisma schema and environment variables
COPY packages/api/prisma ./packages/api/prisma/
COPY .env* ./
COPY packages/api/.env* ./packages/api/

# Generate Prisma client in standard location
RUN cd packages/api && \
    DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    npx prisma generate --schema=./prisma/schema.prisma

# Copy rest of the source code
COPY . .

# Build packages
RUN npm run build

FROM node:18-alpine AS runner

WORKDIR /app

# Install runtime dependencies including OpenSSL
RUN apk add --no-cache openssl

# Copy runtime dependencies and generated Prisma client
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=builder /app/packages/api/prisma ./packages/api/prisma

# Regenerate Prisma client in standard location
RUN cd packages/api && \
    DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    npx prisma generate --schema=./prisma/schema.prisma

# Copy package files and built files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/*/package*.json ./packages/
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/packages/*/dist ./packages/*/dist

# Create log directory and set permissions
RUN mkdir -p /app/logs && chown -R node:node /app

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run as non-root
USER node

# Start application directly
CMD ["node", "dist/server.js"]
