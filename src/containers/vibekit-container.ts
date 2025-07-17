import { Container } from '@cloudflare/containers';

export interface VibkitContainerEnv {
  // Add any environment bindings here if needed
}

export class VibkitContainer extends Container {
  private sandboxId: string;
  private commandServerUrl?: string;
  private envVars: Record<string, string> = {};
  private workingDirectory: string = '/var/vibe0';
  
  // Container configuration
  defaultPort = 8080; // Command server port
  sleepAfter = "10m"; // Default sleep timeout
  enableInternet = true; // Enable internet access for package installation
  
  constructor(ctx: DurableObjectState, env: VibkitContainerEnv) {
    super(ctx, env);
    this.sandboxId = ctx.id.toString();
  }

  // Initialize the container with configuration
  async handleInit(request: Request): Promise<Response> {
    try {
      const body = await request.json() as {
        image?: string;
        envVars?: Record<string, string>;
        instanceType?: string;
        sleepAfter?: string;
        namespace?: string;
        workingDirectory?: string;
      };

      // Store configuration
      this.envVars = body.envVars || {};
      this.workingDirectory = body.workingDirectory || '/var/vibe0';
      if (body.sleepAfter) {
        this.sleepAfter = body.sleepAfter;
      }

      // Set environment variables
      this.env = {
        ...this.envVars,
        WORKING_DIRECTORY: this.workingDirectory,
      };

      // Start the container
      await this.start();

      // Wait for the command server to be ready
      await this.startAndWaitForPorts(this.defaultPort);

      return new Response(JSON.stringify({ 
        sandboxId: this.sandboxId,
        status: 'ready' 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(
        `Failed to initialize container: ${error instanceof Error ? error.message : String(error)}`,
        { status: 500 }
      );
    }
  }

  // Execute a command in the container
  async handleExecute(request: Request): Promise<Response> {
    try {
      const body = await request.json() as {
        command: string;
        background?: boolean;
        timeoutMs?: number;
        workingDirectory?: string;
      };

      // Forward the command to the command server running in the container
      const commandRequest = {
        command: body.command,
        background: body.background || false,
        timeoutMs: body.timeoutMs || 30000,
        workingDirectory: body.workingDirectory || this.workingDirectory,
      };

      // Create a streaming response if not a background command
      if (!body.background) {
        const encoder = new TextEncoder();
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();

        // Execute command asynchronously
        this.executeCommandWithStreaming(commandRequest, writer, encoder).catch(error => {
          writer.write(encoder.encode(JSON.stringify({ 
            type: 'error', 
            content: error.message 
          }) + '\n'));
          writer.close();
        });

        return new Response(stream.readable, {
          headers: {
            'Content-Type': 'application/x-ndjson',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      } else {
        // Background execution
        this.executeCommandBackground(commandRequest);
        return new Response(JSON.stringify({ 
          status: 'started',
          background: true 
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      return new Response(
        `Failed to execute command: ${error instanceof Error ? error.message : String(error)}`,
        { status: 500 }
      );
    }
  }

  // Execute command with streaming output
  private async executeCommandWithStreaming(
    commandRequest: any,
    writer: WritableStreamDefaultWriter,
    encoder: TextEncoder
  ): Promise<void> {
    try {
      // Send request to command server
      const response = await this.containerFetch('/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commandRequest),
      });

      if (!response.ok) {
        throw new Error(`Command server error: ${response.status}`);
      }

      // Stream the response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            await writer.write(encoder.encode(line + '\n'));
          }
        }
      }

      // Handle any remaining buffer
      if (buffer.trim()) {
        await writer.write(encoder.encode(buffer + '\n'));
      }

      await writer.close();
    } catch (error) {
      await writer.write(encoder.encode(JSON.stringify({ 
        type: 'error', 
        content: error instanceof Error ? error.message : String(error)
      }) + '\n'));
      await writer.close();
    }
  }

  // Execute command in background
  private async executeCommandBackground(commandRequest: any): Promise<void> {
    try {
      await this.containerFetch('/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commandRequest),
      });
    } catch (error) {
      console.error('Background command error:', error);
    }
  }

  // Get container status
  async handleStatus(request: Request): Promise<Response> {
    return new Response(JSON.stringify({
      sandboxId: this.sandboxId,
      running: this.ctx.container.running,
      status: 'active'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Kill the container
  async handleKill(request: Request): Promise<Response> {
    try {
      await this.stop('User requested kill');
      return new Response(JSON.stringify({ status: 'killed' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(
        `Failed to kill container: ${error instanceof Error ? error.message : String(error)}`,
        { status: 500 }
      );
    }
  }

  // Pause the container
  async handlePause(request: Request): Promise<Response> {
    try {
      await this.stop('User requested pause');
      return new Response(JSON.stringify({ status: 'paused' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(
        `Failed to pause container: ${error instanceof Error ? error.message : String(error)}`,
        { status: 500 }
      );
    }
  }

  // Get host URL for a specific port
  async handleGetPort(request: Request, port: string): Promise<Response> {
    try {
      const portNum = parseInt(port, 10);
      if (isNaN(portNum)) {
        throw new Error('Invalid port number');
      }

      // Get the Worker URL and construct port access URL
      const url = new URL(request.url);
      const portUrl = `${url.protocol}//${url.host}/container/${this.sandboxId}/port/${portNum}`;

      return new Response(JSON.stringify({ 
        url: portUrl,
        port: portNum 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(
        `Failed to get port URL: ${error instanceof Error ? error.message : String(error)}`,
        { status: 500 }
      );
    }
  }

  // Forward requests to container ports
  async handlePortForward(request: Request, port: string): Promise<Response> {
    try {
      const portNum = parseInt(port, 10);
      if (isNaN(portNum)) {
        throw new Error('Invalid port number');
      }

      // Forward the request to the container
      return await this.containerFetch(request, portNum);
    } catch (error) {
      return new Response(
        `Failed to forward request: ${error instanceof Error ? error.message : String(error)}`,
        { status: 502 }
      );
    }
  }

  // Main request handler
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route requests
    if (path === '/init' && request.method === 'POST') {
      return this.handleInit(request);
    } else if (path === '/execute' && request.method === 'POST') {
      return this.handleExecute(request);
    } else if (path === '/status') {
      return this.handleStatus(request);
    } else if (path === '/kill' && request.method === 'POST') {
      return this.handleKill(request);
    } else if (path === '/pause' && request.method === 'POST') {
      return this.handlePause(request);
    } else if (path.startsWith('/port/')) {
      const port = path.split('/')[2];
      if (request.method === 'GET' && !request.headers.get('X-Port-Forward')) {
        return this.handleGetPort(request, port);
      } else {
        return this.handlePortForward(request, port);
      }
    }

    return new Response('Not found', { status: 404 });
  }

  // Override lifecycle methods
  override onStart(): void {
    console.log(`Container ${this.sandboxId} started`);
  }

  override onStop(): void {
    console.log(`Container ${this.sandboxId} stopped`);
  }

  override onError(error: unknown): void {
    console.error(`Container ${this.sandboxId} error:`, error);
  }
}