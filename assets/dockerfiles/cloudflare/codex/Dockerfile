# Use Ubuntu 22.04 as the base image
FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    bash \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x (LTS)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Install OpenAI Codex globally
RUN npm install -g @openai/codex@latest

# Create working directory
RUN mkdir -p /var/vibe0
WORKDIR /var/vibe0

# Copy command server files (these will be copied by build script)
COPY server.js /opt/command-server/
COPY package.json /opt/command-server/

# Set environment variables
ENV COMMAND_SERVER_PORT=8080
ENV WORKING_DIRECTORY=/var/vibe0

# Expose command server port
EXPOSE 8080

# Start command server
CMD ["node", "/opt/command-server/server.js"]