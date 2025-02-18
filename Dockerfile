# Dockerfile

# Stage 1: Build the application
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies for sharp
RUN apk add --no-cache python3 make g++

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Stage 2: Run the application
FROM node:18-alpine

# Install runtime dependencies for sharp
RUN apk add --no-cache vips-dev

# Set working directory
WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy .env file
COPY .env ./

# Switch to non-root user
USER node

# Expose the desired port
EXPOSE 3000

# Define the default command
CMD ["node", "dist/main"]
