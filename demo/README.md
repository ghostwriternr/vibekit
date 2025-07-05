# VibeKit Cloudflare Containers Demo

This demo showcases **real Docker containers** running on Cloudflare infrastructure integrated with VibeKit.

## 🚀 What This Demo Provides

- ✅ **Real Docker Containers** on Cloudflare's global network
- ✅ **Actual Command Execution** inside containerized environments
- ✅ **VibeKit Integration** with Cloudflare as a sandbox provider
- ✅ **Production Ready** deployment to Cloudflare Workers + Containers

## Prerequisites

1. **Cloudflare Account** with Workers and Containers enabled
2. **API Token** with permissions: `Workers:Edit`, `Containers:Write`
3. **Docker** installed locally (for building container images)

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Development
```bash
# Start local development with real containers
npm run dev

# Build TypeScript
npm run build
```

### 3. Deploy to Production
```bash
# Deploy to Cloudflare (requires API token)
npm run deploy

# Test production deployment
npm run test
```

## Architecture

### Real Container Implementation
- **Dockerfile**: Builds actual container with Node.js + development tools
- **Container App** (`container-app.js`): Express.js server running inside container
- **Worker Proxy** (`src/index.ts`): Routes requests to container instances
- **Durable Objects**: Manages container lifecycle and state

### Container Features
- **Command Execution**: Real shell command execution using Node.js `spawn`
- **Development Tools**: git, python3, typescript, vim, nano, build tools
- **HTTP API**: RESTful endpoints for health, info, and command execution
- **Web Interface**: Interactive UI for testing container functionality

## API Endpoints

When deployed, your container provides:

```bash
# Health check
curl https://your-worker.workers.dev/health

# Container information  
curl https://your-worker.workers.dev/info

# Execute commands
curl -X POST https://your-worker.workers.dev/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "echo Hello World"}'

# Web interface
open https://your-worker.workers.dev
```

## Configuration Files

### `wrangler.jsonc`
```json
{
  "name": "vibekit-containers-v2",
  "containers": [
    {
      "class_name": "VibeKitContainerV2", 
      "image": "./Dockerfile",
      "max_instances": 5
    }
  ]
}
```

### `Dockerfile` 
```dockerfile
FROM node:18
WORKDIR /app
RUN apt-get update && apt-get install -y git python3 build-essential
COPY container-app.js .
RUN npm init -y && npm install express
EXPOSE 8080
CMD ["node", "container-app.js"]
```

## Integration with VibeKit

Use this Cloudflare container as a sandbox provider in VibeKit:

```javascript
import { VibeKit } from '@vibe-kit/sdk';

const vibeKit = new VibeKit({
  agent: { type: 'claude' },
  environment: {
    cloudflare: {
      apiToken: 'your-token',
      accountId: 'your-account',
      scriptName: 'vibekit-containers-v2'
    }
  }
});

const result = await vibeKit.generateCode('echo "Hello from container!"');
console.log(result.stdout); // "Hello from container!"
```

## Project Structure

```
demo/
├── src/
│   └── index.ts              # Worker that routes to containers
├── container-app.js          # Express app running in container
├── Dockerfile               # Container image definition
├── wrangler.jsonc           # Cloudflare deployment config
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── test-production.js       # Production testing script
└── README.md               # This file
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local development server |
| `npm run build` | Build TypeScript |
| `npm run deploy` | Deploy to Cloudflare |
| `npm run test` | Test production deployment |

## Deployment Process

When you run `npm run deploy`:

1. **Docker Build**: Builds container image from Dockerfile
2. **Image Push**: Pushes to Cloudflare's container registry
3. **Worker Deploy**: Deploys TypeScript worker code
4. **Container Start**: Starts containers across Cloudflare's network
5. **Global Distribution**: Available worldwide within minutes

## Troubleshooting

### Common Issues

1. **API Token Permissions**: Ensure token has `Workers:Edit` and `Containers:Write`
2. **Docker Required**: Local Docker must be running for builds
3. **First Deploy**: Initial deployment takes 3-5 minutes for container startup
4. **Port Conflicts**: Local dev uses random ports, check terminal output

### Debug Commands

```bash
# Check deployment status
npx wrangler deployments status

# View logs
npx wrangler tail

# Test locally
npm run dev

# Check account info
npx wrangler whoami
```

## What's Next?

This demo provides a foundation for:
- ✅ Real containerized development environments
- ✅ Global edge compute with containers
- ✅ AI coding agents with actual execution environments
- ✅ Scalable sandbox infrastructure

Ready to deploy real containers to Cloudflare's edge network! 🚀