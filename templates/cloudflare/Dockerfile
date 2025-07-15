# Dockerfile for VibeKit Cloudflare Container
FROM node:18

# Set working directory
WORKDIR /app

# Install basic tools for coding agents
RUN apt-get update && apt-get install -y \
    bash \
    curl \
    git \
    python3 \
    python3-pip \
    build-essential \
    vim \
    nano \
    && rm -rf /var/lib/apt/lists/*

# Install global packages that agents might need
RUN npm install -g typescript ts-node nodemon

# Copy the container application
COPY container-app.js .

# Initialize package.json and install express
RUN npm init -y && npm install express

# Expose the default port for Cloudflare containers
EXPOSE 8080

# Start the container application
CMD ["node", "container-app.js"]