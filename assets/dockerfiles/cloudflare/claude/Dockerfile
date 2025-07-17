# Use Cloudflare Sandbox SDK base image
FROM docker.io/ghostwriternr/cloudflare-sandbox:0.0.5

# Install Claude Code dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ripgrep \
    bash \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x (LTS)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Install Claude Code globally
RUN npm install -g @anthropic-ai/claude-code@latest

# Create working directory
RUN mkdir -p /var/vibe0
WORKDIR /var/vibe0

# Set environment variables
ENV WORKING_DIRECTORY=/var/vibe0

# Expose SDK command server port
EXPOSE 3000

# The SDK's command server starts automatically
CMD ["bun", "index.ts"]