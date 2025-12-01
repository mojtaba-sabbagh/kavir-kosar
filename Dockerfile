# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app
# Copy files needed for installing dependencies
COPY package.json package-lock.json* ./
# COPY THE PRISMA SCHEMA EARLY so 'prisma generate' can run during 'npm ci'
COPY prisma ./prisma/
# Install all dependencies including devDependencies (needed for building)
RUN npm ci
# Generate Prisma client explicitly
RUN npx prisma generate

# Stage 2: Builder - build the application and generate Prisma client
FROM node:18-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build the Next.js app (prisma client is already generated)
RUN npm run build

# Stage 3: Runner - create the final, lean production image
FROM node:18-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy the generated Prisma client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# You might also need to copy the Prisma schema for the 'migrate deploy' command to work
COPY --from=builder /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

# The command to run: deploy migrations and then start the app
CMD npx prisma migrate deploy && node server.js