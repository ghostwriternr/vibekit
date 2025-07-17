# VibeKit Docker Images (Maintainer Documentation)

**⚠️ This directory is for VibeKit maintainers only. If you're using the VibeKit SDK, you don't need anything from here!**

## For VibeKit SDK Users

**You don't need to build or manage any Docker images!** 

- **E2B**: Automatically uses pre-built templates
- **Modal/Daytona**: Pulls pre-built images from Docker Hub
- **Cloudflare**: Uses the Sandbox SDK base image automatically

Just install VibeKit and start coding:
```bash
npm install @vibe-kit/sdk
```

---

## For VibeKit Maintainers Only

This directory contains the Docker build system for publishing VibeKit's official images.

### Structure

```
dockerfiles/
├── Dockerfile                   # Unified Dockerfile for Docker Hub & E2B
├── Dockerfile.cloudflare        # For custom Cloudflare builds (rarely needed)
├── install-agent.sh             # Shared installation script
├── build-images.sh              # Build script for maintainers
└── README.md                    # This documentation
```

### Publishing New Images

To publish updated images to Docker Hub (maintainers only):

```bash
cd assets/dockerfiles
./build-images.sh

# Then push to Docker Hub
docker push superagentai/vibekit-claude:1.0
docker push superagentai/vibekit-codex:1.0
# ... etc
```

### About Dockerfile.cloudflare

The `Dockerfile.cloudflare` extends the Sandbox SDK base image to:
- Pre-install specific agent CLIs (claude-code, gemini-cli, etc.) for faster startup
- Set up the working directory (`/var/vibe0`) where commands are executed
- Configure the container to work with the SDK's Bun command server (port 3000)

While users could install agents dynamically via `exec()`, pre-installing them in the image provides better performance and consistent environments.

### Technical Details

The unified Dockerfile approach uses build arguments:
- `AGENT_TYPE`: Which agent to install (claude, codex, gemini, opencode, shopify)
- `NODE_VERSION`: Node.js version (defaults to 24)

All installation logic is centralized in `install-agent.sh`, making it easy to maintain and update.