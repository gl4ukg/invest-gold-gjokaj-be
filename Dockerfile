# Stage 1: Build the application
FROM node:18 AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Stage 2: Run the application
FROM node:18

RUN apt-get update && apt-get install -y libvips && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy app, build output and dependencies from builder
COPY --from=builder /app /app
COPY --from=builder /app/node_modules ./node_modules

COPY .env ./

USER node

EXPOSE 3000

CMD ["node", "dist/main"]
