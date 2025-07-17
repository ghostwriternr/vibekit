# VibeKit Integration with Cloudflare Sandbox SDK - Implementation Plan

## Executive Summary

After analyzing both the Cloudflare Sandbox SDK and VibeKit's current implementation, I recommend **adopting the Sandbox SDK** with minimal modifications. The SDK provides exactly what VibeKit needs: a clean abstraction over containers with HTTP-based command execution through `exec()`. VibeKit is already using a similar pattern with its own command server.

## Architecture Analysis

### VibeKit's Current Architecture
- Uses `sandbox.commands.run()` abstraction across all providers
- HTTP-based command server running Node.js on port 8080 that executes commands via `bash -c`
- Provider-agnostic interface works for E2B, Daytona, Northflank, and Cloudflare

### Sandbox SDK Architecture
- Bun-based server with `/api/execute` endpoint for command execution
- General purpose `exec()` method that executes any command via shell
- Additional features: File operations, Git operations, session management
- Clean Durable Object integration with well-tested container lifecycle management

### Key Compatibility Points
- The Bun runtime is only for the command server, not the execution environment
- Commands run via `exec()` can install any language/tool needed (Node, Python, etc.)
- VibeKit agents can continue installing their tools after container starts as before

## Comparison: VibeKit vs Sandbox SDK

| Feature | VibeKit Current | Sandbox SDK | Match? |
|---------|----------------|-------------|---------|
| Command Execution | HTTP server → bash -c | HTTP server → bash -c | ✅ |
| Server Runtime | Node.js | Bun | ✅ (Both work) |
| Exec Method | commands.run() | exec() | ✅ |
| Streaming Output | ✅ NDJSON | ✅ SSE | ✅ |
| File Operations | Via exec | Built-in methods | ✅+ |
| Session Management | External | Built-in | ✅+ |
| Container Lifecycle | Manual | Automated | ✅+ |

## Benefits of Adopting Sandbox SDK

### 1. Less Code to Maintain
- Remove custom command server (server.js)
- Remove VibkitContainer boilerplate
- Use battle-tested SDK implementation

### 2. Better Features Out of Box
- Session management for tracking agent work
- File operation conveniences (though exec works too)
- Git operations for cloning repos
- Proper streaming with SSE

### 3. Cleaner Integration
- Sandbox class extends Container with proper lifecycle
- getSandbox() helper for easy access
- Consistent with Cloudflare patterns

### 4. Agent Flexibility Maintained
- Each agent type still gets custom Docker image
- Agents install their tools via exec() as before
- No change to agent workflows

## Implementation Plan

### Option 1: Direct SDK Adoption (Recommended)

1. **Install Sandbox SDK**
   ```bash
   npm install @cloudflare/sandbox
   ```

2. **Modify CloudflareSandboxProvider**
   ```typescript
   import { Sandbox, getSandbox } from '@cloudflare/sandbox';
   
   export class CloudflareSandboxProvider implements SandboxProvider {
     async create(config, envs, agentType) {
       const env = (globalThis as any).env;
       const sandbox = getSandbox(env.Sandbox, `vibekit-${Date.now()}`);
       
       // The SDK handles all initialization
       return new CloudflareSandboxInstance(sandbox, sandboxId);
     }
   }
   ```

3. **Update CloudflareSandboxInstance**
   ```typescript
   export class CloudflareSandboxInstance implements SandboxInstance {
     constructor(private sandbox: Sandbox, public sandboxId: string) {}
     
     get commands(): SandboxCommands {
       return {
         run: async (command, options) => {
           const result = await this.sandbox.exec(command, [], {
             stream: options?.onStdout || options?.onStderr
           });
           return {
             exitCode: result.exitCode,
             stdout: result.stdout,
             stderr: result.stderr
           };
         }
       };
     }
   }
   ```

4. **Update Dockerfiles**
   - Base them on SDK's Dockerfile
   - Add agent-specific tools on top

### Option 2: Minimal SDK Fork

If SDK needs modifications:

1. **Fork the SDK**
2. **Add VibeKit-specific features**:
   - Support for agent-specific images in Sandbox class
   - Environment variable pass-through
   - Working directory configuration

3. **Publish as @vibekit/sandbox**

### Migration Path

1. **Phase 1**: Use SDK as-is
   - Test with existing agent workflows
   - Verify exec() supports all needed commands
   - Check streaming performance

2. **Phase 2**: Optimize if needed
   - Add any missing features to SDK
   - Submit PRs upstream if generally useful

## Recommendation

**Use the Cloudflare Sandbox SDK directly**. It provides:
- The same command execution model VibeKit already uses
- Better abstractions and lifecycle management
- Less code to maintain
- Additional features (sessions, file ops) as bonuses

## Action Items

1. **Immediate**:
   - ✅ Install @cloudflare/sandbox
   - ✅ Update CloudflareSandboxProvider to use SDK
   - ✅ Test with existing agent workflows
   - ✅ Remove custom command server code

2. **Follow-up**:
   - ✅ Update documentation to reference SDK
   - ✅ Create agent-specific Dockerfiles based on SDK base
   - ✅ Consider using SDK's session management
   - ✅ Evaluate file operation methods for agent use

## Conclusion

The Cloudflare Sandbox SDK is an excellent fit for VibeKit. It provides the same HTTP-based command execution model VibeKit already uses, with better abstractions and additional features. The SDK architecture aligns perfectly with VibeKit's requirements for sandbox providers.