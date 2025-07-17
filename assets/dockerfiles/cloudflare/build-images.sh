#!/bin/bash

# Build script for Cloudflare container images using Sandbox SDK

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGISTRY=${REGISTRY:-"registry.cloudflare.com"}
NAMESPACE=${NAMESPACE:-"vibekit"}
TAG=${TAG:-"2.0-sdk"}

echo -e "${YELLOW}Building VibeKit Cloudflare container images with Sandbox SDK...${NC}"

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Build each agent image
for agent in claude codex gemini opencode; do
    echo -e "\n${GREEN}Building $agent image...${NC}"
    
    # Navigate to agent directory
    cd "$SCRIPT_DIR/$agent"
    
    # Build the image (no need to copy command server files - SDK provides it)
    IMAGE_NAME="$REGISTRY/$NAMESPACE/vibekit-$agent:$TAG"
    docker build -t "$IMAGE_NAME" .
    
    echo -e "${GREEN}✓ Built $IMAGE_NAME${NC}"
done

echo -e "\n${GREEN}All images built successfully!${NC}"
echo -e "\n${YELLOW}To push images to Cloudflare registry:${NC}"
echo "1. Ensure you're logged in: wrangler login"
echo "2. Push each image:"
for agent in claude codex gemini opencode; do
    echo "   wrangler containers push $REGISTRY/$NAMESPACE/vibekit-$agent:$TAG"
done