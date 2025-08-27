# Use Node.js 20 Alpine as base for minimal image size
FROM node:20-alpine

# Set working directory for all subsequent operations
WORKDIR /app

# Install system dependencies required for node-gyp and other build tools
# These are needed for building native modules and development tools
RUN apk add --no-cache python3 make g++

# Copy package.json files first to leverage Docker layer caching
# This way, dependencies are only reinstalled if package.json changes
COPY package*.json ./
COPY packages/api/package*.json ./packages/api/

# Install project dependencies
# First install root dependencies (monorepo setup)
# Then install API-specific dependencies
RUN npm install
RUN cd packages/api && npm install

# Install TypeScript globally for build tools
# This is required for the build process but not for production runtime
RUN npm install -g typescript

# Copy the rest of the application code
# This is done after dependency installation to leverage caching
COPY . .

# Generate Prisma client and build TypeScript code
# This creates the production-ready JavaScript in dist/
RUN cd packages/api && \
    npx prisma generate && \
    npm run build

# Set working directory to the API package
WORKDIR /app/packages/api

# Configure production environment
ENV NODE_ENV=production
ENV PORT=3000

# Document the port that the application listens on
EXPOSE 3000

# Start the application using the compiled JavaScript
# We use the compiled code instead of ts-node for better performance
CMD ["node", "dist/main.js"]
