import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CodexAgent } from "../src/agents/codex";
import { CodexConfig, CodexStreamCallbacks } from "../src/types";
import { Sandbox } from "@e2b/code-interpreter";
import { generatePRMetadata } from "../src/agents/utils.js";
import { createSandboxProvider } from "../src/services/sandbox.js";

// Mock dependencies
vi.mock("e2b");
vi.mock("@ai-sdk/openai");
vi.mock("../src/agents/utils.js");
vi.mock("../src/services/sandbox.js");

const MockedSandbox = vi.mocked(Sandbox);
const MockedCreateSandboxProvider = vi.mocked(createSandboxProvider);

describe("CodexAgent", () => {
  let config: CodexConfig;
  let mockSandbox: any;
  let codexAgent: CodexAgent;

  beforeEach(() => {
    config = {
      providerApiKey: "test-openai-key",
      githubToken: "test-github-token",
      repoUrl: "octocat/hello-world",
      e2bApiKey: "test-e2b-key",
      e2bTemplateId: "test-template-id",
      sandboxConfig: {
        type: "e2b" as const,
        apiKey: "test-e2b-key",
        templateId: "test-template-id",
      },
      model: "gpt-4",
    };

    mockSandbox = {
      sandboxId: "test-sandbox-id",
      commands: {
        run: vi.fn(),
      },
      kill: vi.fn(),
      pause: vi.fn(),
    };

    const mockProvider = {
      create: vi.fn().mockResolvedValue(mockSandbox),
      resume: vi.fn().mockResolvedValue(mockSandbox),
    };
    MockedCreateSandboxProvider.mockReturnValue(mockProvider);

    codexAgent = new CodexAgent(config);

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with provided config", () => {
      expect(codexAgent).toBeInstanceOf(CodexAgent);
    });

    it("should throw error when no API key is provided", () => {
      const configWithoutKey = {
        githubToken: "test-github-token",
        repoUrl: "octocat/hello-world",
        e2bApiKey: "test-e2b-key",
        e2bTemplateId: "test-template-id",
        sandboxConfig: {
          type: "e2b" as const,
          apiKey: "test-e2b-key",
          templateId: "test-template-id",
        },
        model: "gpt-4",
      };
      expect(() => new CodexAgent(configWithoutKey as any)).toThrow(
        "Provider API key is required. Please provide providerApiKey, apiKey, or openaiApiKey."
      );
    });

    it("should support custom provider", () => {
      const configWithProvider = {
        providerApiKey: "test-openai-key",
        provider: "anthropic" as const,
        githubToken: "test-github-token",
        repoUrl: "octocat/hello-world",
        e2bApiKey: "test-e2b-key",
        e2bTemplateId: "test-template-id",
        sandboxConfig: {
          type: "e2b" as const,
          apiKey: "test-e2b-key",
          templateId: "test-template-id",
        },
        model: "gpt-4",
      };
      const agent = new CodexAgent(configWithProvider);
      expect(agent).toBeInstanceOf(CodexAgent);
    });
  });

  describe("getSandbox", () => {
    it("should create a new sandbox when no sandboxId is provided", async () => {
      const mockProvider = {
        create: vi.fn().mockResolvedValue(mockSandbox),
        resume: vi.fn().mockResolvedValue(mockSandbox),
      };
      MockedCreateSandboxProvider.mockReturnValue(mockProvider);

      await codexAgent.generateCode("test prompt");

      expect(mockProvider.create).toHaveBeenCalledWith(
        {
          type: "e2b",
          apiKey: "test-e2b-key",
          templateId: "test-template-id",
        },
        {
          OPENAI_API_KEY: "test-openai-key",
        },
        "codex"
      );
    });

    it("should resume existing sandbox when sandboxId is provided", async () => {
      const mockProvider = {
        create: vi.fn().mockResolvedValue(mockSandbox),
        resume: vi.fn().mockResolvedValue(mockSandbox),
      };
      MockedCreateSandboxProvider.mockReturnValue(mockProvider);

      const configWithSandboxId = {
        ...config,
        sandboxId: "existing-sandbox-id",
      };
      const agentWithExistingSandbox = new CodexAgent(configWithSandboxId);

      await agentWithExistingSandbox.generateCode("test prompt");

      expect(mockProvider.resume).toHaveBeenCalledWith("existing-sandbox-id", {
        type: "e2b",
        apiKey: "test-e2b-key",
        templateId: "test-template-id",
      });
    });

    it("should reuse existing sandbox instance", async () => {
      const mockProvider = {
        create: vi.fn().mockResolvedValue(mockSandbox),
        resume: vi.fn().mockResolvedValue(mockSandbox),
      };
      MockedCreateSandboxProvider.mockReturnValue(mockProvider);

      await codexAgent.generateCode("test prompt 1");
      await codexAgent.generateCode("test prompt 2");

      expect(mockProvider.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("killSandbox", () => {
    it("should kill the sandbox if it exists", async () => {
      await codexAgent.generateCode("test prompt");
      await codexAgent.killSandbox();

      expect(mockSandbox.kill).toHaveBeenCalled();
    });

    it("should not throw error if no sandbox exists", async () => {
      await expect(codexAgent.killSandbox()).resolves.not.toThrow();
    });
  });

  describe("pauseSandbox", () => {
    it("should pause the sandbox if it exists", async () => {
      await codexAgent.generateCode("test prompt");
      await codexAgent.pauseSandbox();

      expect(mockSandbox.pause).toHaveBeenCalled();
    });

    it("should not throw error if no sandbox exists", async () => {
      await expect(codexAgent.pauseSandbox()).resolves.not.toThrow();
    });
  });

  describe("resumeSandbox", () => {
    it("should resume the sandbox if it exists", async () => {
      const mockProvider = {
        create: vi.fn().mockResolvedValue(mockSandbox),
        resume: vi.fn().mockResolvedValue(mockSandbox),
      };
      MockedCreateSandboxProvider.mockReturnValue(mockProvider);

      await codexAgent.generateCode("test prompt");
      await codexAgent.resumeSandbox();

      expect(mockProvider.resume).toHaveBeenCalledWith("test-sandbox-id", {
        type: "e2b",
        apiKey: "test-e2b-key",
        templateId: "test-template-id",
      });
    });

    it("should not throw error if no sandbox exists", async () => {
      await expect(codexAgent.resumeSandbox()).resolves.not.toThrow();
    });
  });

  describe("generateCode", () => {
    beforeEach(() => {
      mockSandbox.commands.run.mockResolvedValue({
        exitCode: 0,
        stdout: "Code generated successfully",
        stderr: "",
      });
    });

    it("should generate code successfully with new sandbox", async () => {
      const result = await codexAgent.generateCode(
        "Create a hello world function"
      );

      expect(result).toEqual({
        sandboxId: "test-sandbox-id",
        exitCode: 0,
        stdout: "Code generated successfully",
        stderr: "",
      });
    });

    it("should clone repository for new sandbox", async () => {
      await codexAgent.generateCode("test prompt");

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        "cd /vibe0 && git clone https://x-access-token:test-github-token@github.com/octocat/hello-world.git .",
        { timeoutMs: 3600000, background: false }
      );
    });

    it("should configure git user for new sandbox", async () => {
      await codexAgent.generateCode("test prompt");

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        'cd /vibe0 && git config user.name "github-actions[bot]" && git config user.email "github-actions[bot]@users.noreply.github.com"',
        { timeoutMs: 60000, background: false }
      );
    });

    it("should run codex command with correct parameters", async () => {
      await codexAgent.generateCode("test prompt");

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        'cd /vibe0 && codex --full-auto --model gpt-4 --provider openai --quiet "Do the necessary changes to the codebase based on the users input.\nDon\'t ask any follow up questions.\n\nUser: test prompt"',
        expect.objectContaining({
          timeoutMs: 3600000,
          background: false,
        })
      );
    });

    it("should run codex command without model parameter when not specified", async () => {
      const configWithoutModel = { ...config };
      delete configWithoutModel.model;
      const agentWithoutModel = new CodexAgent(configWithoutModel);

      await agentWithoutModel.generateCode("test prompt");

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        'cd /vibe0 && codex --full-auto --provider openai --quiet "Do the necessary changes to the codebase based on the users input.\nDon\'t ask any follow up questions.\n\nUser: test prompt"',
        expect.objectContaining({
          timeoutMs: 3600000,
          background: false,
        })
      );
    });

    it("should run codex command with custom provider", async () => {
      const configWithProvider = {
        providerApiKey: "test-openai-key",
        provider: "anthropic" as const,
        githubToken: "test-github-token",
        repoUrl: "octocat/hello-world",
        e2bApiKey: "test-e2b-key",
        e2bTemplateId: "test-template-id",
        sandboxConfig: {
          type: "e2b" as const,
          apiKey: "test-e2b-key",
          templateId: "test-template-id",
        },
        model: "gpt-4",
      };
      const agentWithProvider = new CodexAgent(configWithProvider);

      await agentWithProvider.generateCode("test prompt");

      expect(mockSandbox.commands.run).toHaveBeenNthCalledWith(
        4,
        'cd /vibe0 && codex --full-auto --model gpt-4 --provider anthropic --quiet "Do the necessary changes to the codebase based on the users input.\nDon\'t ask any follow up questions.\n\nUser: test prompt"',
        expect.objectContaining({
          timeoutMs: 3600000,
          background: false,
        })
      );
    });

    it("should set correct environment variable for custom provider", async () => {
      const configWithProvider = {
        providerApiKey: "test-openai-key",
        provider: "anthropic" as const,
        githubToken: "test-github-token",
        repoUrl: "octocat/hello-world",
        e2bApiKey: "test-e2b-key",
        e2bTemplateId: "test-template-id",
        sandboxConfig: {
          type: "e2b" as const,
          apiKey: "test-e2b-key",
          templateId: "test-template-id",
        },
        model: "gpt-4",
      };
      const agentWithProvider = new CodexAgent(configWithProvider);

      const mockProvider = {
        create: vi.fn().mockResolvedValue(mockSandbox),
        resume: vi.fn().mockResolvedValue(mockSandbox),
      };
      MockedCreateSandboxProvider.mockReturnValue(mockProvider);

      await agentWithProvider.generateCode("test prompt");

      expect(mockProvider.create).toHaveBeenCalledWith(
        {
          type: "e2b",
          apiKey: "test-e2b-key",
          templateId: "test-template-id",
        },
        {
          ANTHROPIC_API_KEY: "test-openai-key",
        },
        "codex"
      );
    });

    it("should call callbacks when provided", async () => {
      const callbacks: CodexStreamCallbacks = {
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };

      await codexAgent.generateCode(
        "test prompt",
        "code",
        undefined,
        [],
        callbacks
      );

      expect(callbacks.onUpdate).toHaveBeenCalledWith(
        '{"type": "start", "sandbox_id": "test-sandbox-id"}'
      );
      expect(callbacks.onUpdate).toHaveBeenCalledWith(
        '{"type": "git", "output": "Cloning repository: octocat/hello-world"}'
      );
      expect(callbacks.onUpdate).toHaveBeenCalledWith(
        expect.stringContaining('{"type": "end"')
      );
    });

    it("should handle existing sandbox correctly", async () => {
      const configWithSandboxId = {
        ...config,
        sandboxId: "existing-sandbox-id",
      };
      const agentWithExistingSandbox = new CodexAgent(configWithSandboxId);

      const callbacks: CodexStreamCallbacks = {
        onUpdate: vi.fn(),
      };

      await agentWithExistingSandbox.generateCode(
        "test prompt",
        "code",
        undefined,
        [],
        callbacks
      );

      expect(callbacks.onUpdate).toHaveBeenCalledWith(
        '{"type": "start", "sandbox_id": "existing-sandbox-id"}'
      );
      // Should not call git clone for existing sandbox
      expect(mockSandbox.commands.run).not.toHaveBeenCalledWith(
        expect.stringContaining("git clone"),
        expect.any(Object)
      );
    });

    it("should throw error when sandbox command fails", async () => {
      mockSandbox.commands.run.mockRejectedValue(new Error("Command failed"));

      await expect(codexAgent.generateCode("test prompt")).rejects.toThrow(
        "Failed to generate code: Command failed"
      );
    });

    it("should throw error when sandbox creation fails", async () => {
      const mockProvider = {
        create: vi.fn().mockRejectedValue(new Error("Sandbox creation failed")),
        resume: vi.fn().mockResolvedValue(mockSandbox),
      };
      MockedCreateSandboxProvider.mockReturnValue(mockProvider);

      await expect(codexAgent.generateCode("test prompt")).rejects.toThrow(
        "Sandbox creation failed"
      );
    });
  });
});
