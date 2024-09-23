# Use the official Node.js 20 image as a base
FROM node:20

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json (if you have one)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# Build the SvelteKit app
RUN npm run build

# Expose the port the app will run on
EXPOSE 3000

# Set environment variables if necessary
ENV NODE_ENV=production

# Command to start the Node.js server
CMD ["node", "build"]

