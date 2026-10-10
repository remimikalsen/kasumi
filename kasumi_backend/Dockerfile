# Node 22 LTS, slim image for a smaller attack surface
FROM node:22-trixie-slim

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install production dependencies only, from the lockfile
RUN npm ci --omit=dev

# Create the data directory
RUN mkdir -p /app/data

# Copy the application code to the container
COPY ./src .
COPY entrypoint.sh /app/entrypoint.sh
RUN chown -R node:node /app && chmod +x /app/entrypoint.sh

# Expose the port your app runs on
EXPOSE 3000

# The entrypoint fixes ownership of the data volume, then runs the server as the node user
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server.js"]
