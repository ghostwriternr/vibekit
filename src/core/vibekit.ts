import {
  VibeKitConfig,
  CodexConfig,
  CodexResponse,
  CodexStreamCallbacks,
  ClaudeConfig,
  ClaudeResponse,
  ClaudeStreamCallbacks,
  OpenCodeConfig,
  OpenCodeResponse,
  OpenCodeStreamCallbacks,
  Conversation,
  SandboxConfig,
  GeminiConfig,
  LabelOptions,
} from "../types";
import { CodexAgent } from "../agents/codex";
import { ClaudeAgent } from "../agents/claude";
import { OpenCodeAgent } from "../agents/opencode";
import { GeminiAgent } from "../agents/gemini";
import {
  BaseAgent,
  AgentResponse as BaseAgentResponse,
  StreamCallbacks,
} from "../agents/base";
import { TelemetryService } from "../services/telemetry";
import { createSandboxConfigFromEnvironment } from "../services/sandbox";

export type AgentResponse =
  | CodexResponse
  | ClaudeResponse
  | OpenCodeResponse
  | { code: string };

// Unified streaming callback interface
export interface VibeKitStreamCallbacks {
  onUpdate?: (message: string) => void;
  onError?: (error: string) => void;
}

// Pull request response interface
export interface PullRequestResponse {
  html_url: string;
  number: number;
  branchName: string;
  commitSha?: string;
}

export class VibeKit {
  private agent: BaseAgent;
  private setup: VibeKitConfig;
  private telemetryService?: TelemetryService;

  constructor(setup: VibeKitConfig) {
    this.setup = setup;

    // Initialize telemetry service if enabled
    if (setup.telemetry?.isEnabled) {
      this.telemetryService = new TelemetryService(
        setup.telemetry,
        setup.sessionId
      );
    }

    // Initialize the appropriate agent
    this.agent = this.createAgent(setup);
  }

  private createAgent(setup: VibeKitConfig): BaseAgent {
    // Create sandbox configuration from the environment
    const sandboxConfig = createSandboxConfigFromEnvironment(
      setup.environment,
      setup.agent.type,
      setup.workingDirectory
    );

    if (setup.agent.type === "codex") {
      const codexConfig: CodexConfig = {
        providerApiKey: setup.agent.model.apiKey,
        provider: setup.agent.model.provider,
        githubToken: setup.github?.token,
        repoUrl: setup.github?.repository,
        // Keep backward compatibility for E2B-specific configs
        e2bApiKey: sandboxConfig.type === "e2b" ? (sandboxConfig.apiKey || "") : "",
        e2bTemplateId: sandboxConfig.templateId,
        model: setup.agent.model.name,
        sandboxId: setup.sessionId,
        telemetry: setup.telemetry,
        // Add new sandbox config
        sandboxConfig,
        // Pass secrets to agent
        secrets: setup.secrets,
        workingDirectory: setup.workingDirectory,
      };
      return new CodexAgent(codexConfig);
    } else if (setup.agent.type === "claude") {
      const claudeConfig: ClaudeConfig = {
        providerApiKey: setup.agent.model.apiKey,
        provider: setup.agent.model.provider,
        githubToken: setup.github?.token,
        repoUrl: setup.github?.repository,
        // Keep backward compatibility for E2B-specific configs
        e2bApiKey: sandboxConfig.type === "e2b" ? (sandboxConfig.apiKey || "") : "",
        e2bTemplateId: sandboxConfig.templateId,
        model: setup.agent.model.name,
        sandboxId: setup.sessionId,
        telemetry: setup.telemetry,
        // Add new sandbox config
        sandboxConfig,
        // Pass secrets to agent
        secrets: setup.secrets,
        workingDirectory: setup.workingDirectory,
      };
      return new ClaudeAgent(claudeConfig);
    } else if (setup.agent.type === "opencode") {
      const openCodeConfig: OpenCodeConfig = {
        providerApiKey: setup.agent.model.apiKey,
        provider: setup.agent.model.provider,
        githubToken: setup.github?.token,
        repoUrl: setup.github?.repository,
        // Keep backward compatibility for E2B-specific configs
        e2bApiKey: sandboxConfig.type === "e2b" ? (sandboxConfig.apiKey || "") : "",
        e2bTemplateId: sandboxConfig.templateId,
        model: setup.agent.model.name,
        sandboxId: setup.sessionId,
        telemetry: setup.telemetry,
        // Add new sandbox config
        sandboxConfig,
        // Pass secrets to agent
        secrets: setup.secrets,
        workingDirectory: setup.workingDirectory,
      };
      return new OpenCodeAgent(openCodeConfig);
    } else if (setup.agent.type === "gemini") {
      const geminiConfig: GeminiConfig = {
        providerApiKey: setup.agent.model.apiKey,
        provider: setup.agent.model.provider,
        githubToken: setup.github?.token,
        repoUrl: setup.github?.repository,
        e2bApiKey: sandboxConfig.type === "e2b" ? (sandboxConfig.apiKey || "") : "",
        e2bTemplateId: sandboxConfig.templateId,
        model: setup.agent.model.name,
        sandboxId: setup.sessionId,
        telemetry: setup.telemetry,
        // Add new sandbox config
        sandboxConfig,
        // Pass secrets to agent
        secrets: setup.secrets,
        workingDirectory: setup.workingDirectory,
      };
      return new GeminiAgent(geminiConfig);
    } else {
      throw new Error(`Unsupported agent type: ${setup.agent.type}`);
    }
  }

  private getDataType(data: string): string {
    try {
      const parsed = JSON.parse(data);
      return parsed.type || "unknown";
    } catch {
      return "stream_output";
    }
  }

  async generateCode({
    prompt,
    mode,
    branch,
    history,
    callbacks,
    background,
  }: {
    prompt: string;
    mode: "ask" | "code";
    branch?: string;
    history?: Conversation[];
    background?: boolean;
    callbacks?: VibeKitStreamCallbacks;
  }): Promise<AgentResponse> {
    const agentType = this.setup.agent.type;

    // Track telemetry start
    await this.telemetryService?.trackStart(agentType, mode, prompt, {
      repoUrl: this.setup.github?.repository,
      model: this.setup.agent.model.name,
      hasHistory: !!history?.length,
    });

    if (callbacks) {
      // Wrap callbacks with telemetry tracking
      const wrappedCallbacks = {
        onUpdate: async (data: string) => {
          callbacks.onUpdate?.(data);
          await this.telemetryService?.trackStream(
            agentType,
            mode,
            prompt,
            data,
            undefined,
            this.setup.github?.repository,
            {
              dataType: this.getDataType(data),
            }
          );
        },
        onError: async (error: string) => {
          callbacks.onError?.(error);
          await this.telemetryService?.trackError(
            agentType,
            mode,
            prompt,
            error,
            {
              source: `${agentType}_agent`,
            }
          );
        },
      };

      try {
        const result = await this.agent.generateCode(
          prompt,
          mode,
          branch,
          history,
          wrappedCallbacks,
          background
        );

        await this.telemetryService?.trackEnd(
          agentType,
          mode,
          prompt,
          result.sandboxId,
          this.setup.github?.repository,
          {
            exitCode: result.exitCode,
            stdoutLength: result.stdout?.length || 0,
            stderrLength: result.stderr?.length || 0,
          }
        );

        return result;
      } catch (error) {
        const errorMessage = `${agentType} generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`;

        await this.telemetryService?.trackError(
          agentType,
          mode,
          prompt,
          errorMessage,
          {
            errorType:
              error instanceof Error ? error.constructor.name : "UnknownError",
            source: "vibekit",
          }
        );

        throw error;
      }
    }

    // Non-streaming path
    try {
      const result = await this.agent.generateCode(
        prompt,
        mode,
        branch,
        history,
        undefined,
        background
      );

      await this.telemetryService?.trackEnd(
        agentType,
        mode,
        prompt,
        result.sandboxId,
        this.setup.github?.repository,
        {
          exitCode: result.exitCode,
          stdoutLength: result.stdout?.length || 0,
          stderrLength: result.stderr?.length || 0,
        }
      );

      return result;
    } catch (error) {
      const errorMessage = `${agentType} generation failed: ${
        error instanceof Error ? error.message : String(error)
      }`;

      await this.telemetryService?.trackError(
        agentType,
        mode,
        prompt,
        errorMessage,
        {
          errorType:
            error instanceof Error ? error.constructor.name : "UnknownError",
          source: "vibekit",
        }
      );

      throw error;
    }
  }

  /**
   * Create a Pull Request after generating code changes.
   * This method is available for both Codex and Claude agents and automatically labels
   * the pull request with the agent name ('codex' or 'claude').
   *
   * @returns Promise<PullRequestResponse> - Contains the PR URL, number, branch name, and commit SHA
   * @throws Error if the agent is not supported or if PR creation fails
   */
  async createPullRequest(
    labelOptions?: LabelOptions,
    branchPrefix?: string
  ): Promise<PullRequestResponse> {
    return this.agent.createPullRequest(labelOptions, branchPrefix);
  }

  /**
   * Run tests in the sandbox environment.
   * This method executes common test commands and automatically detects the appropriate test runner.
   *
   * @param branch - Optional branch to run tests on
   * @param history - Optional conversation history for context
   * @param callbacks - Optional callbacks for streaming updates and errors
   * @returns Promise<AgentResponse> - Contains the test execution results
   */
  async runTests({
    branch,
    history,
    callbacks,
  }: {
    branch?: string;
    history?: Conversation[];
    callbacks?: VibeKitStreamCallbacks;
  }): Promise<AgentResponse> {
    return this.agent.runTests(branch, history, callbacks);
  }

  async pushToBranch(branch?: string): Promise<void> {
    return this.agent.pushToBranch(branch);
  }

  /**
   * Kill the active sandbox.
   */
  async kill(): Promise<void> {
    return this.agent.killSandbox();
  }

  /**
   * Pause the active sandbox.
   */
  async pause(): Promise<void> {
    return this.agent.pauseSandbox();
  }

  /**
   * Resume the paused sandbox.
   */
  async resume(): Promise<void> {
    return this.agent.resumeSandbox();
  }

  /**
   * Get the current session ID from the sandbox.
   *
   * @returns Promise<string | null> - The sandbox session ID or null if not available
   */
  async getSession(): Promise<string | null> {
    return this.agent.getSession();
  }

  /**
   * Set the session ID for the sandbox.
   *
   * @param sessionId - The session ID to set
   */
  async setSession(sessionId: string): Promise<void> {
    return this.agent.setSession(sessionId);
  }

  /**
   * Get the host URL for a specific port in the sandbox.
   * Note: This method is only supported for Northflank & E2B sandboxes.
   *
   * @param port - The port number to get the host for
   * @returns Promise<string> - The host URL for the specified port
   * @throws Error if using Daytona sandbox (not implemented)
   */
  async getHost(port: number): Promise<string> {
    return this.agent.getHost(port);
  }

  /**
   * Set the GitHub token for repository operations.
   *
   * @param token - The GitHub token to set
   */
  setGithubToken(token: string): void {
    this.agent.setGithubToken(token);
    if (this.setup.github) {
      this.setup.github.token = token;
    } else {
      this.setup.github = { token, repository: "" };
    }
  }

  /**
   * Set the GitHub repository URL for operations.
   *
   * @param repoUrl - The repository URL (e.g., 'owner/repo')
   */
  setGithubRepository(repoUrl: string): void {
    this.agent.setGithubRepository(repoUrl);
    if (this.setup.github) {
      this.setup.github.repository = repoUrl;
    } else {
      this.setup.github = { token: "", repository: repoUrl };
    }
  }

  async executeCommand(
    command: string,
    options: {
      timeoutMs?: number;
      background?: boolean;
      callbacks?: VibeKitStreamCallbacks;
    } = {}
  ): Promise<BaseAgentResponse> {
    const { callbacks, ...agentOptions } = options;
    const agentType = this.setup.agent.type;

    // Track telemetry start
    await this.telemetryService?.trackStart(agentType, "ask", command, {
      repoUrl: this.setup.github?.repository,
      model: this.setup.agent.model.name,
      commandType: "execute",
    });

    if (callbacks) {
      // Wrap callbacks with telemetry tracking
      const wrappedCallbacks: StreamCallbacks = {
        onUpdate: async (data: string) => {
          callbacks.onUpdate?.(data);
          await this.telemetryService?.trackStream(
            agentType,
            "ask",
            command,
            data,
            undefined,
            this.setup.github?.repository,
            {
              dataType: this.getDataType(data),
              commandType: "execute",
            }
          );
        },
        onError: async (error: string) => {
          callbacks.onError?.(error);
          await this.telemetryService?.trackError(
            agentType,
            "ask",
            command,
            error,
            {
              source: `${agentType}_agent`,
              commandType: "execute",
            }
          );
        },
      };

      try {
        const result = await this.agent.executeCommand(command, {
          ...agentOptions,
          callbacks: wrappedCallbacks,
        });

        await this.telemetryService?.trackEnd(
          agentType,
          "ask",
          command,
          result.sandboxId,
          this.setup.github?.repository,
          {
            exitCode: result.exitCode,
            stdoutLength: result.stdout?.length || 0,
            stderrLength: result.stderr?.length || 0,
            commandType: "execute",
          }
        );

        return result;
      } catch (error) {
        const errorMessage = `Command execution failed: ${
          error instanceof Error ? error.message : String(error)
        }`;

        await this.telemetryService?.trackError(
          agentType,
          "ask",
          command,
          errorMessage,
          {
            errorType:
              error instanceof Error ? error.constructor.name : "UnknownError",
            source: "vibekit",
            commandType: "execute",
          }
        );

        throw error;
      }
    }

    // Non-streaming path
    try {
      const result = await this.agent.executeCommand(command, agentOptions);

      await this.telemetryService?.trackEnd(
        agentType,
        "ask",
        command,
        result.sandboxId,
        this.setup.github?.repository,
        {
          exitCode: result.exitCode,
          stdoutLength: result.stdout?.length || 0,
          stderrLength: result.stderr?.length || 0,
          commandType: "execute",
        }
      );

      return result;
    } catch (error) {
      const errorMessage = `Command execution failed: ${
        error instanceof Error ? error.message : String(error)
      }`;

      await this.telemetryService?.trackError(
        agentType,
        "ask",
        command,
        errorMessage,
        {
          errorType:
            error instanceof Error ? error.constructor.name : "UnknownError",
          source: "vibekit",
          commandType: "execute",
        }
      );

      throw error;
    }
  }
}
