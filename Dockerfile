FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies for building)
RUN yarn install --frozen-lockfile

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the application code
COPY . .

# Build the NestJS application
RUN yarn build

# Stage 2: Production
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built application and necessary files from the builder stage
COPY --from=builder /app/package.json ./
COPY --from=builder /app/yarn.lock ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose the application port (default NestJS port is 3000)
EXPOSE 3000

# Start the application
CMD ["yarn", "start:prod"]
