import { VibeKit } from '@vibe-kit/sdk';
import { VibkitContainer } from '@vibe-kit/sdk/containers';

// Export the Durable Object
export { VibkitContainer };

// Environment interface
interface Env {
  // Durable Object binding
  VIBEKIT_CONTAINER: DurableObjectNamespace;
  
  // API Keys
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  GOOGLE_API_KEY: string;
  GITHUB_TOKEN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint
    if (path === '/health') {
      return new Response(JSON.stringify({ status: 'healthy' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Main agent endpoint
    if (path === '/agent' && request.method === 'POST') {
      try {
        const body = await request.json() as {
          prompt: string;
          agent?: 'claude' | 'codex' | 'gemini' | 'opencode';
          mode?: 'ask' | 'code';
          stream?: boolean;
        };

        // Determine which API key to use based on agent type
        let apiKey: string;
        let provider: string;
        
        switch (body.agent || 'claude') {
          case 'claude':
            apiKey = env.ANTHROPIC_API_KEY;
            provider = 'anthropic';
            break;
          case 'codex':
            apiKey = env.OPENAI_API_KEY;
            provider = 'openai';
            break;
          case 'gemini':
            apiKey = env.GOOGLE_API_KEY;
            provider = 'google';
            break;
          case 'opencode':
            apiKey = env.OPENAI_API_KEY;
            provider = 'openai';
            break;
          default:
            apiKey = env.ANTHROPIC_API_KEY;
            provider = 'anthropic';
        }

        // Initialize VibeKit with Cloudflare Containers
        const vibekit = new VibeKit({
          agent: {
            type: body.agent || 'claude',
            model: {
              apiKey,
              provider: provider as any
            }
          },
          environment: {
            cloudflare: {
              type: 'direct',
              binding: 'VIBEKIT_CONTAINER',
              instanceType: 'standard',
              sleepAfter: '10m'
            }
          },
          github: env.GITHUB_TOKEN ? {
            token: env.GITHUB_TOKEN,
            repository: url.searchParams.get('repo') || ''
          } : undefined
        });

        // Handle streaming response
        if (body.stream) {
          const stream = new TransformStream();
          const writer = stream.writable.getWriter();
          const encoder = new TextEncoder();

          // Run agent asynchronously with streaming
          vibekit.runAgent(body.prompt, {
            mode: body.mode || 'code',
            onUpdate: async (message) => {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ 
                type: 'update', 
                message 
              })}\n\n`));
            }
          }).then(async (result) => {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ 
              type: 'complete', 
              result 
            })}\n\n`));
            await writer.close();
          }).catch(async (error) => {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ 
              type: 'error', 
              error: error.message 
            })}\n\n`));
            await writer.close();
          });

          return new Response(stream.readable, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          });
        } else {
          // Non-streaming response
          const result = await vibekit.runAgent(body.prompt, {
            mode: body.mode || 'code'
          });

          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (error) {
        console.error('Agent error:', error);
        return new Response(JSON.stringify({ 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 404 for unknown routes
    return new Response('Not found', { 
      status: 404,
      headers: corsHeaders 
    });
  }
};