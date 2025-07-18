#!/bin/bash

# Build script for standard (E2B/Docker Hub) container images

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGISTRY=${REGISTRY:-"superagentai"}
TAG=${TAG:-"1.0"}

echo -e "${YELLOW}Building VibeKit standard container images...${NC}"

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Determine Node.js version for each agent
get_node_version() {
    case $1 in
        shopify) echo "20" ;;
        *) echo "24" ;;
    esac
}

# Build each agent image using the unified Dockerfile
for agent in claude codex gemini opencode shopify; do
    echo -e "\n${GREEN}Building $agent image...${NC}"
    
    cd "$SCRIPT_DIR"
    
    # Get Node.js version for this agent
    NODE_VER=$(get_node_version $agent)
    
    # Build the image with build arguments
    IMAGE_NAME="$REGISTRY/vibekit-$agent:$TAG"
    docker build \
        --build-arg AGENT_TYPE=$agent \
        --build-arg NODE_VERSION=$NODE_VER \
        -f Dockerfile \
        -t "$IMAGE_NAME" .
    
    echo -e "${GREEN}✓ Built $IMAGE_NAME${NC}"
done

echo -e "\n${GREEN}All images built successfully!${NC}"
echo -e "\n${YELLOW}To push images to Docker Hub:${NC}"
for agent in claude codex gemini opencode shopify; do
    echo "   docker push $REGISTRY/vibekit-$agent:$TAG"
done