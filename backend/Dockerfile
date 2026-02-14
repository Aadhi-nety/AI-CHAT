FROM node:18-alpine

WORKDIR /app

# Install AWS CLI and dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    groff \
    less \
    bash \
    curl \
    git

# Install AWS CLI v2
RUN pip3 install awscli-v2

# Copy backend package files
COPY backend/package*.json ./
COPY backend/tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY backend/src ./src

# Compile TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 3001 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start application
CMD ["npm", "start"]
