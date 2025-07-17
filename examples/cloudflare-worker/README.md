# VibeKit Cloudflare Worker Example

This example demonstrates how to use VibeKit with Cloudflare Containers to run coding agents on Cloudflare's edge network.

## Setup

1. **Install dependencies:**
   ```bash
   npm install @vibe-kit/sdk
   ```

2. **Configure your account ID:**
   Edit `wrangler.toml` and add your Cloudflare account ID:
   ```toml
   account_id = "your-account-id"
   ```

3. **Set up secrets:**
   ```bash
   wrangler secret put ANTHROPIC_API_KEY
   wrangler secret put OPENAI_API_KEY
   wrangler secret put GOOGLE_API_KEY
   wrangler secret put GITHUB_TOKEN  # Optional
   ```

4. **Build and push container images:**
   ```bash
   # From the vibekit root directory
   cd assets/dockerfiles/cloudflare
   ./build-images.sh
   
   # Push to your registry
   wrangler containers push registry.cloudflare.com/your-namespace/vibekit-claude:1.0
   ```

5. **Deploy the Worker:**
   ```bash
   wrangler deploy
   ```

## Usage

### Basic Request

```bash
curl -X POST https://your-worker.workers.dev/agent \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a function to calculate fibonacci numbers",
    "agent": "claude",
    "mode": "code"
  }'
```

### Streaming Request

```bash
curl -X POST https://your-worker.workers.dev/agent \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a React component for a todo list",
    "agent": "claude",
    "mode": "code",
    "stream": true
  }'
```

### With GitHub Integration

```bash
curl -X POST https://your-worker.workers.dev/agent?repo=owner/repo \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Fix the bug in src/utils.js",
    "agent": "claude",
    "mode": "code"
  }'
```

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /agent` - Run a coding agent

### Request Body

```typescript
{
  prompt: string;          // The prompt for the agent
  agent?: 'claude' | 'codex' | 'gemini' | 'opencode';  // Agent type (default: claude)
  mode?: 'ask' | 'code';   // Execution mode (default: code)
  stream?: boolean;        // Enable streaming response (default: false)
}
```

### Response

Non-streaming:
```json
{
  "exitCode": 0,
  "stdout": "...",
  "stderr": "...",
  "sandboxId": "..."
}
```

Streaming (Server-Sent Events):
```
data: {"type": "update", "message": "Installing dependencies..."}
data: {"type": "update", "message": "Running tests..."}
data: {"type": "complete", "result": {...}}
```

## Monitoring

View logs and metrics:
```bash
wrangler tail
```

Or visit the [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → Containers.

## Customization

### Change Container Resources

Edit `wrangler.toml`:
```toml
instance_type = "basic"  # Options: "dev", "basic", "standard"
```

### Adjust Timeout

In `worker.ts`:
```typescript
sleepAfter: '30m'  // Keep container alive for 30 minutes
```

### Add Custom Secrets

```typescript
secrets: {
  MY_API_KEY: env.MY_API_KEY,
  DATABASE_URL: env.DATABASE_URL
}
```