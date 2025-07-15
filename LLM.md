# VibeKit SDK API Documentation

## Overview
VibeKit is a TypeScript SDK for running AI coding agents (Claude, Codex, Gemini, OpenCode) in secure sandboxes with GitHub integration.

**Package**: `@vibe-kit/sdk`  
**Version**: 0.0.46  
**Main Entry**: `dist/index.js`

## Installation
```bash
npm install @vibe-kit/sdk
```

## Quick Start
```typescript
import { VibeKit } from '@vibe-kit/sdk';

const vibekit = new VibeKit({
  agent: {
    type: 'codex',
    model: { provider: 'openai', apiKey: 'your-key' }
  },
  environment: {
    e2b: { apiKey: 'your-e2b-key' }
  }
});

const result = await vibekit.generateCode({
  prompt: 'Add error handling to login function',
  mode: 'code'
});
```

## Core Classes

### VibeKit
**Import**: `import { VibeKit } from '@vibe-kit/sdk'`

Main SDK class for AI-powered code generation and sandbox management.

#### Constructor
```typescript
new VibeKit(config: VibeKitConfig)
```

#### Methods
- `generateCode(options): Promise<AgentResponse>` - Generate code with AI
  - `options.prompt: string` - Code generation prompt
  - `options.mode: 'ask' | 'code'` - Ask questions or generate code
  - `options.branch?: string` - Git branch to work on
  - `options.history?: Conversation[]` - Chat history
  - `options.callbacks?: VibeKitStreamCallbacks` - Streaming callbacks
  - `options.background?: boolean` - Run in background

- `runTests(options): Promise<AgentResponse>` - Run tests in sandbox
- `createPullRequest(labelOptions?, branchPrefix?): Promise<PullRequestResponse>` - Create GitHub PR
- `executeCommand(command, options?): Promise<BaseAgentResponse>` - Execute shell command
- `kill(): Promise<void>` - Terminate sandbox
- `pause(): Promise<void>` - Pause sandbox
- `resume(): Promise<void>` - Resume sandbox
- `getSession(): Promise<string | null>` - Get session ID
- `setSession(sessionId): Promise<void>` - Set session ID
- `getHost(port): Promise<string>` - Get sandbox host URL

## Agent Classes

### CodexAgent
**Import**: `import { CodexAgent } from '@vibe-kit/sdk'`

OpenAI Codex agent for code generation.

```typescript
new CodexAgent(config: CodexConfig)
```

**Config**:
- `providerApiKey: string` - OpenAI API key
- `sandboxConfig: SandboxConfig` - Sandbox configuration
- `provider?: ModelProvider` - Model provider
- `model?: string` - Specific model name
- `githubToken?: string` - GitHub token
- `repoUrl?: string` - Repository URL

### ClaudeAgent
**Import**: `import { ClaudeAgent } from '@vibe-kit/sdk'`

Anthropic Claude agent for code generation.

```typescript
new ClaudeAgent(config: ClaudeConfig)
```

**Config**: Similar to CodexAgent but requires `provider: 'anthropic'`

### GeminiAgent
**Import**: `import { GeminiAgent } from '@vibe-kit/sdk'`

Google Gemini agent for code generation.

```typescript
new GeminiAgent(config: GeminiConfig)
```

**Config**: Similar to CodexAgent but supports `provider: 'gemini' | 'google'`

### OpenCodeAgent
**Import**: `import { OpenCodeAgent } from '@vibe-kit/sdk'`

SST OpenCode agent for code generation.

```typescript
new OpenCodeAgent(config: OpenCodeConfig)
```

**Config**: Similar to CodexAgent with flexible provider support

### BaseAgent
**Import**: `import { BaseAgent } from '@vibe-kit/sdk'`

Abstract base class for all agents. Common methods:
- `generateCode(prompt, mode?, branch?, history?, callbacks?, background?): Promise<AgentResponse>`
- `executeCommand(command, options?): Promise<AgentResponse>`
- `createPullRequest(labelOptions?, branchPrefix?): Promise<PullRequestResult>`
- `killSandbox(): Promise<void>`
- `pauseSandbox(): Promise<void>`
- `resumeSandbox(): Promise<void>`
- `setGithubToken(token): void`
- `setGithubRepository(repoUrl): void`

## Configuration Types

### VibeKitConfig
```typescript
interface VibeKitConfig {
  agent: {
    type: AgentType;
    model: AgentModel;
  };
  environment: EnvironmentConfig;
  secrets?: SecretsConfig;
  github?: GithubConfig;
  telemetry?: TelemetryConfig;
  sessionId?: string;
  workingDirectory?: string;
}
```

### AgentType
```typescript
type AgentType = 'codex' | 'claude' | 'opencode' | 'gemini'
```

### AgentModel
```typescript
interface AgentModel {
  name?: string;
  provider?: ModelProvider;
  apiKey: string;
}
```

### ModelProvider
```typescript
type ModelProvider = 'openai' | 'anthropic' | 'azure' | 'gemini' | 'google' | ...
```

### SandboxConfig
```typescript
interface SandboxConfig {
  type: 'e2b' | 'daytona' | 'northflank';
  apiKey: string;
  templateId?: string;
  image?: string;
  serverUrl?: string;
  projectId?: string;
  workingDirectory?: string;
}
```

### EnvironmentConfig
```typescript
interface EnvironmentConfig {
  e2b?: E2BConfig;
  daytona?: DaytonaConfig;
  northflank?: NorthflankConfig;
}
```

## Response Types

### AgentResponse
```typescript
interface AgentResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
  sandboxId: string;
  patch?: string;
  patchApplyScript?: string;
  branchName?: string;
  commitSha?: string;
}
```

### PullRequestResponse
```typescript
interface PullRequestResponse {
  html_url: string;
  number: number;
  branchName: string;
  commitSha?: string;
}
```

## Streaming Callbacks

### VibeKitStreamCallbacks
```typescript
interface VibeKitStreamCallbacks {
  onUpdate?: (message: string) => void;
  onError?: (error: string) => void;
}
```

## Services

### TelemetryService
**Import**: `import { TelemetryService } from '@vibe-kit/sdk'`

OpenTelemetry-based service for tracking agent operations.

```typescript
new TelemetryService(config: TelemetryConfig, sessionId?: string)
```

**Methods**:
- `trackStart(agentType, mode, prompt, metadata?): Promise<void>`
- `trackStream(agentType, mode, prompt, streamData, sandboxId?, repoUrl?, metadata?): Promise<void>`
- `trackEnd(agentType, mode, prompt, sandboxId?, repoUrl?, metadata?): Promise<void>`
- `trackError(agentType, mode, prompt, error, metadata?): Promise<void>`
- `shutdown(): Promise<void>`

### Sandbox Providers
**Import**: `import { createSandboxProvider } from '@vibe-kit/sdk'`

```typescript
const provider = createSandboxProvider('e2b' | 'daytona' | 'northflank');
const sandbox = await provider.create(config, envs?, agentType?);
```

## Utility Functions

### generatePRMetadata
**Import**: `import { generatePRMetadata } from '@vibe-kit/sdk'`

```typescript
const metadata = await generatePRMetadata(patch, modelConfig, prompt);
// Returns: { title, body, branchName, commitMessage }
```

### generateCommitMessage
**Import**: `import { generateCommitMessage } from '@vibe-kit/sdk'`

```typescript
const { commitMessage } = await generateCommitMessage(patch, modelConfig, prompt);
```

## Usage Examples

### Basic Code Generation
```typescript
import { VibeKit } from '@vibe-kit/sdk';

const vibekit = new VibeKit({
  agent: {
    type: 'claude',
    model: {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY
    }
  },
  environment: {
    e2b: { apiKey: process.env.E2B_API_KEY }
  },
  github: {
    token: process.env.GITHUB_TOKEN,
    repoUrl: 'owner/repo'
  }
});

const result = await vibekit.generateCode({
  prompt: 'Add input validation to the user registration form',
  mode: 'code',
  branch: 'feature/validation',
  callbacks: {
    onUpdate: (msg) => console.log('Progress:', msg),
    onError: (err) => console.error('Error:', err)
  }
});

if (result.exitCode === 0) {
  const pr = await vibekit.createPullRequest({
    name: 'enhancement',
    color: '0075ca',
    description: 'New feature or request'
  });
  console.log('PR created:', pr.html_url);
}
```

### Direct Agent Usage
```typescript
import { CodexAgent } from '@vibe-kit/sdk';

const agent = new CodexAgent({
  providerApiKey: process.env.OPENAI_API_KEY,
  sandboxConfig: {
    type: 'e2b',
    apiKey: process.env.E2B_API_KEY
  },
  githubToken: process.env.GITHUB_TOKEN,
  repoUrl: 'owner/repo'
});

const response = await agent.generateCode(
  'Refactor the authentication middleware',
  'code',
  'refactor/auth',
  [], // conversation history
  { onUpdate: console.log }
);
```

### Streaming with History
```typescript
const history = [
  { role: 'user', content: 'What does this function do?' },
  { role: 'assistant', content: 'This function handles user authentication...' }
];

const result = await vibekit.generateCode({
  prompt: 'Now add rate limiting to it',
  mode: 'code',
  history,
  callbacks: {
    onUpdate: (chunk) => {
      // Stream to UI
      updateUI(chunk);
    }
  }
});
```

### Sandbox Management
```typescript
// Execute custom commands
const cmdResult = await vibekit.executeCommand('npm test', {
  timeoutMs: 30000,
  callbacks: { onUpdate: console.log }
});

// Get sandbox host for port forwarding
const host = await vibekit.getHost(3000);
console.log('App running at:', host);

// Pause/resume for cost optimization
await vibekit.pause();
// ... later
await vibekit.resume();

// Clean up
await vibekit.kill();
```

## Supported Sandbox Runtimes

- **E2B**: Cloud-based code execution environment
- **Daytona**: Development environment platform
- **Northflank**: Container-based sandbox platform

## Error Handling

All methods return promises that may reject. Always wrap in try-catch:

```typescript
try {
  const result = await vibekit.generateCode({ prompt: '...', mode: 'code' });
  if (result.exitCode !== 0) {
    console.error('Command failed:', result.stderr);
  }
} catch (error) {
  console.error('SDK error:', error.message);
}
```

## Environment Variables

Common environment variables:
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `GOOGLE_API_KEY` - Google API key
- `E2B_API_KEY` - E2B sandbox API key
- `DAYTONA_API_KEY` - Daytona API key
- `NORTHFLANK_API_KEY` - Northflank API key
- `GITHUB_TOKEN` - GitHub personal access token

## TypeScript Support

Fully typed with TypeScript definitions included. Import types:

```typescript
import type {
  VibeKitConfig,
  AgentResponse,
  AgentType,
  ModelProvider,
  SandboxConfig,
  StreamCallbacks
} from '@vibe-kit/sdk';
```
