# Cloudflare Containers Setup Guide for VibeKit

## Overview

VibeKit now supports running coding agents on Cloudflare Containers using the Cloudflare Sandbox SDK, enabling you to leverage Cloudflare's global edge network for running Claude, Codex, Gemini, and OpenCode agents.

**Important**: This implementation requires your application to run on Cloudflare Workers. Support for running from any platform will be added in a future release.

## Prerequisites

- Cloudflare account with Workers and Containers access
- Wrangler CLI installed (`npm install -g wrangler`)
- Docker installed (for building container images)
- Your application must run on Cloudflare Workers

## Setup Steps

### 1. Install VibeKit and Cloudflare Sandbox SDK

```bash
npm install @vibe-kit/sdk @cloudflare/sandbox
```

### 2. Configure Your Worker

Create or update your `wrangler.toml` file:

```toml
name = "my-vibekit-app"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# Container configuration using Sandbox SDK
[[containers]]
name = "vibekit-sandbox"
class_name = "Sandbox"
image = "./vibekit-container"  # Path to container image
instance_type = "standard"
max_instances = 10

# Durable Object binding
[[durable_objects.bindings]]
name = "Sandbox"
class_name = "Sandbox"

# Migration for Durable Objects
[[migrations]]
tag = "v1"
new_sqlite_classes = ["Sandbox"]

# Enable observability (optional but recommended)
[observability]
enabled = true
```

### 3. Set Up Your Worker

In your main worker file:

```typescript
import { VibeKit } from '@vibe-kit/sdk';
import { Sandbox } from '@cloudflare/sandbox';

// Export the Sandbox Durable Object
export { Sandbox };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const vibekit = new VibeKit({
      agent: {
        type: 'claude',
        model: {
          apiKey: env.ANTHROPIC_API_KEY,
          provider: 'anthropic'
        }
      },
      environment: {
        cloudflare: {
          type: 'direct',
          binding: 'Sandbox',  // Must match your wrangler.toml binding
          instanceType: 'standard',
          sleepAfter: '10m'
        }
      }
    });

    // Use VibeKit as normal
    const response = await vibekit.runAgent('Write a hello world function');
    
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

### 4. Build and Deploy Container Images

The VibeKit container images are now based on the Cloudflare Sandbox SDK base image.

#### Build Custom Images

1. Navigate to the dockerfiles directory:
   ```bash
   cd assets/dockerfiles/cloudflare
   ```

2. Run the build script:
   ```bash
   ./build-images.sh
   ```

3. Push images to Cloudflare:
   ```bash
   wrangler containers push registry.cloudflare.com/<your-namespace>/vibekit-claude:2.0-sdk
   wrangler containers push registry.cloudflare.com/<your-namespace>/vibekit-codex:2.0-sdk
   wrangler containers push registry.cloudflare.com/<your-namespace>/vibekit-gemini:2.0-sdk
   wrangler containers push registry.cloudflare.com/<your-namespace>/vibekit-opencode:2.0-sdk
   ```

**Note**: These images use the Cloudflare Sandbox SDK's base image (`docker.io/ghostwriternr/cloudflare-sandbox:0.0.5`) which includes a Bun-based command server.

### 6. Deploy Your Worker

```bash
wrangler deploy
```

## Configuration Options

### CloudflareConfig

```typescript
interface CloudflareConfig {
  type: 'direct';                    // Direct Worker integration
  binding: string;                   // Durable Object binding name
  namespace?: string;                // Container namespace (optional)
  instanceType?: 'dev' | 'basic' | 'standard';  // Container size
  maxInstances?: number;             // Max concurrent containers
  sleepAfter?: string;               // Inactivity timeout (e.g., "10m", "1h")
}
```

### Instance Types

| Type | Memory | vCPU | Disk | Use Case |
|------|--------|------|------|----------|
| dev | 256 MiB | 1/16 | 2 GB | Testing & development |
| basic | 1 GiB | 1/4 | 4 GB | Light workloads |
| standard | 4 GiB | 1/2 | 4 GB | Production workloads |

## Example: Complete Worker

```typescript
import { VibeKit } from '@vibe-kit/sdk';
import { Sandbox } from '@cloudflare/sandbox';

export { Sandbox };

interface Env {
  Sandbox: DurableObjectNamespace;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  GITHUB_TOKEN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Initialize VibeKit with Cloudflare Sandbox SDK
    const vibekit = new VibeKit({
      agent: {
        type: url.searchParams.get('agent') as any || 'claude',
        model: {
          apiKey: env.ANTHROPIC_API_KEY,
          provider: 'anthropic'
        }
      },
      environment: {
        cloudflare: {
          type: 'direct',
          binding: 'Sandbox',
          instanceType: 'standard',
          sleepAfter: '10m'
        }
      },
      secrets: {
        GITHUB_TOKEN: env.GITHUB_TOKEN
      }
    });

    try {
      const prompt = await request.text();
      const response = await vibekit.runAgent(prompt, {
        mode: 'code',
        onUpdate: (message) => {
          console.log('Progress:', message);
        }
      });

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
```

## Streaming Responses

To stream agent output back to clients:

```typescript
const stream = new TransformStream();
const writer = stream.writable.getWriter();
const encoder = new TextEncoder();

// Run agent with streaming
vibekit.runAgent(prompt, {
  onUpdate: async (message) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify({ message })}\n\n`));
  }
}).then(async (result) => {
  await writer.write(encoder.encode(`data: ${JSON.stringify({ done: true, result })}\n\n`));
  await writer.close();
}).catch(async (error) => {
  await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
  await writer.close();
});

return new Response(stream.readable, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  },
});
```

## Monitoring and Debugging

### Enable Observability

In your `wrangler.toml`:

```toml
[observability]
enabled = true
```

### View Logs

```bash
wrangler tail
```

### Container Dashboard

Visit the [Cloudflare Dashboard](https://dash.cloudflare.com) and navigate to Workers & Pages → Containers to view:
- Container status
- Resource usage
- Execution logs
- Performance metrics

## Best Practices

1. **Container Lifecycle**: Containers automatically sleep after the configured timeout. Set `sleepAfter` based on your usage patterns.

2. **Resource Sizing**: Start with `dev` instance type for testing, then upgrade to `standard` for production workloads.

3. **Error Handling**: Always wrap VibeKit calls in try-catch blocks to handle container startup failures gracefully.

4. **Secrets Management**: Use Worker environment variables for API keys and sensitive data.

5. **Monitoring**: Enable observability to track container performance and debug issues.

## Troubleshooting

### Container Won't Start

- Check your wrangler.toml configuration
- Verify the Durable Object binding name matches your code
- Ensure container images are pushed to the registry
- Check Worker logs: `wrangler tail`

### Command Execution Fails

- Verify the Sandbox SDK command server is running (port 3000)
- Check container logs in the dashboard
- Ensure sufficient resources (upgrade instance type if needed)
- The SDK uses Bun runtime for the command server

### Binding Not Found Error

- Confirm the binding name in your code matches wrangler.toml
- Ensure you've run `wrangler deploy` after updating configuration
- Check that migrations include your Durable Object class

## Limitations

- **Worker-Only**: Currently requires your application to run on Cloudflare Workers
- **Cold Starts**: Initial container startup may take a few seconds
- **Port Access**: Direct TCP/UDP access requires Worker proxy
- **Regional**: Containers start in the nearest available region

## Future Enhancements

- Universal access via control plane (no Worker requirement)
- Direct SSH access to containers
- Persistent storage volumes
- Custom networking configurations
- Multi-region container placement

## Support

For issues and questions:
- GitHub Issues: [vibekit/issues](https://github.com/vibekit/vibekit/issues)
- Discord: [Join our community](https://discord.gg/vibekit)
- Documentation: [docs.vibekit.sh](https://docs.vibekit.sh)