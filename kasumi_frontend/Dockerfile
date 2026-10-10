# ---- Build stage -----------------------------------------------------------
FROM node:22-trixie-slim AS build

WORKDIR /app

# Install all dependencies (dev dependencies are needed to build)
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code and build the SvelteKit app
COPY . .
RUN npm run build

# ---- Runtime stage ---------------------------------------------------------
FROM node:22-trixie-slim

WORKDIR /app
ENV NODE_ENV=production

# Only the built server and production dependencies end up in the final image
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/build ./build

# Run as the unprivileged node user
USER node

# Expose the port the app will run on
EXPOSE 3000

# Command to start the Node.js server
CMD ["node", "build"]
