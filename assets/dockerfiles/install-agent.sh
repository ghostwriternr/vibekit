#!/bin/bash
set -e

# Common installation steps for all agents
AGENT_TYPE=${1:-claude}
NODE_VERSION=${2:-24}

echo "Installing VibeKit agent: $AGENT_TYPE with Node.js $NODE_VERSION"

# Update and install common dependencies
apt-get update && apt-get install -y \
    curl \
    git \
    ripgrep \
    bash \
    ca-certificates \
    gnupg

# Clean up apt cache to reduce image size
rm -rf /var/lib/apt/lists/*

# Install Node.js
echo "Installing Node.js ${NODE_VERSION}.x..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

# Clean up again after Node.js installation
apt-get clean
rm -rf /var/lib/apt/lists/*

# Install agent-specific CLI
echo "Installing agent CLI for: $AGENT_TYPE"
case $AGENT_TYPE in
    claude)
        npm install -g @anthropic-ai/claude-code@latest
        ;;
    codex)
        npm install -g @openai/codex@latest
        ;;
    gemini)
        npm install -g @google/gemini-cli
        ;;
    opencode)
        npm install -g opencode-ai@latest
        ;;
    shopify)
        # Special case: install both Claude Code and Shopify CLI
        npm install -g @anthropic-ai/claude-code@latest @shopify/cli@latest
        ;;
    *)
        echo "Unknown agent type: $AGENT_TYPE"
        exit 1
        ;;
esac

# Clean npm cache
npm cache clean --force

# Verify installations
echo "Verifying installations..."
node -v && npm -v && git --version

echo "Agent installation complete!"