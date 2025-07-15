import { Container as CloudflareContainer } from '@cloudflare/containers'
import { Hono } from 'hono'

export interface Env {
  VibeKitContainerV2: DurableObjectNamespace
  ANTHROPIC_API_KEY?: string
  VIBEKIT_MODE?: string
  MESSAGE?: string
}

export class VibeKitContainerV2 extends CloudflareContainer {
  defaultPort = 8080;
  sleepAfter = '5m';
  envVars = {
    MESSAGE: 'Hello from VibeKit Cloudflare Container!',
    NODE_ENV: 'production',
    VIBEKIT_MODE: 'container'
  };
}

// Worker entry point
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const app = new Hono()
    
    // Route to container instances - singleton pattern
    app.all('/*', async (c) => {
      // Get a single container instance for all requests
      const id = env.VibeKitContainerV2.idFromName('singleton')
      const containerInstance = env.VibeKitContainerV2.get(id)
      
      // Proxy all requests to the container
      return containerInstance.fetch(c.req.raw)
    })
    
    return app.fetch(request, env)
  }
}

