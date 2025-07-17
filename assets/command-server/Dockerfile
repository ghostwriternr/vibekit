FROM node:18-slim

# Install basic utilities
RUN apt-get update && apt-get install -y \
    bash \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
RUN mkdir -p /var/vibe0
WORKDIR /var/vibe0

# Copy command server
COPY server.js /opt/command-server/
COPY package.json /opt/command-server/

# Set environment variables
ENV COMMAND_SERVER_PORT=8080
ENV WORKING_DIRECTORY=/var/vibe0

# Expose command server port
EXPOSE 8080

# Start command server
CMD ["node", "/opt/command-server/server.js"]