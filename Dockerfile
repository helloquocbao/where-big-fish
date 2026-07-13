# Use a lightweight Node image
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and workspaces package.json files
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies for all workspaces
RUN npm ci

# Copy full source
COPY . .

# Build all workspaces (build:shared, build:backend)
RUN npm run build:shared
RUN npm run build -w backend

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

# Copy built code and node_modules from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/backend/package*.json ./backend/
COPY --from=builder /app/backend/dist ./backend/dist

EXPOSE 2567

ENV PORT=2567
ENV NODE_ENV=production

CMD ["npm", "run", "start", "-w", "backend"]
