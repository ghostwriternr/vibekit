import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GeminiAgent } from "../src/agents/gemini";
import { GeminiConfig, GeminiStreamCallbacks } from "../src/types";
import { Sandbox } from "@e2b/code-interpreter";
import { createSandboxProvider } from "../src/services/sandbox.js";

// Mock dependencies
vi.mock("e2b");
vi.mock("../src/agents/utils.js");
vi.mock("../src/services/sandbox.js");

const MockedSandbox = vi.mocked(Sandbox);
const MockedCreateSandboxProvider = vi.mocked(createSandboxProvider);

describe("GeminiAgent", () => {
  let config: GeminiConfig;
  let mockSandbox: any;
  let geminiAgent: GeminiAgent;

  beforeEach(() => {
    config = {
      providerApiKey: "test-gemini-key",
      githubToken: "test-github-token",
      repoUrl: "octocat/hello-world",
      e2bApiKey: "test-e2b-key",
      e2bTemplateId: "vibekit-gemini",
      sandboxConfig: {
        type: "e2b" as const,
        apiKey: "test-e2b-key",
        templateId: "vibekit-gemini",
      },
      model: "gemini-2.0-flash-exp",
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

    geminiAgent = new GeminiAgent(config);

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with provided config", () => {
      expect(geminiAgent).toBeInstanceOf(GeminiAgent);
    });

    it("should initialize with custom model", () => {
      const customConfig = { ...config, model: "gemini-2.5-pro-preview-05-06" };
      const customAgent = new GeminiAgent(customConfig);
      expect(customAgent).toBeInstanceOf(GeminiAgent);
    });

    it("should initialize without model (uses default)", () => {
      const configWithoutModel = { ...config };
      delete configWithoutModel.model;
      const agentWithoutModel = new GeminiAgent(configWithoutModel);
      expect(agentWithoutModel).toBeInstanceOf(GeminiAgent);
    });

    it("should accept gemini provider", () => {
      const configWithGeminiProvider = {
        ...config,
        provider: "gemini" as const,
      };
      const agent = new GeminiAgent(configWithGeminiProvider);
      expect(agent).toBeInstanceOf(GeminiAgent);
    });

    it("should accept google provider", () => {
      const configWithGoogleProvider = {
        ...config,
        provider: "google" as const,
      };
      const agent = new GeminiAgent(configWithGoogleProvider);
      expect(agent).toBeInstanceOf(GeminiAgent);
    });

    it("should reject non-gemini/google providers", () => {
      const configWithOpenAiProvider = {
        ...config,
        provider: "openai" as const,
      };
      expect(() => new GeminiAgent(configWithOpenAiProvider)).toThrow(
        "Gemini agent only supports 'gemini' or 'google' provider"
      );
    });

    it("should work without provider specified", () => {
      const agent = new GeminiAgent(config);
      expect(agent).toBeInstanceOf(GeminiAgent);
    });

    it("should throw error when sandboxConfig is not provided", () => {
      const configWithoutSandbox = { ...config };
      delete configWithoutSandbox.sandboxConfig;
      expect(() => new GeminiAgent(configWithoutSandbox)).toThrow(
        "sandboxConfig is required"
      );
    });
  });

  describe("getSandbox", () => {
    it("should create a new sandbox when no sandboxId is provided", async () => {
      const mockProvider = {
        create: vi.fn().mockResolvedValue(mockSandbox),
        resume: vi.fn().mockResolvedValue(mockSandbox),
      };
      MockedCreateSandboxProvider.mockReturnValue(mockProvider);

      await geminiAgent.generateCode("test prompt");

      expect(mockProvider.create).toHaveBeenCalledWith(
        {
          type: "e2b",
          apiKey: "test-e2b-key",
          templateId: "vibekit-gemini",
        },
        {
          GEMINI_API_KEY: "test-gemini-key",
          GOOGLE_API_KEY: "test-gemini-key",
        },
        "gemini"
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
      const agentWithExistingSandbox = new GeminiAgent(configWithSandboxId);

      await agentWithExistingSandbox.generateCode("test prompt");

      expect(mockProvider.resume).toHaveBeenCalledWith("existing-sandbox-id", {
        type: "e2b",
        apiKey: "test-e2b-key",
        templateId: "vibekit-gemini",
      });
    });

    it("should reuse existing sandbox instance", async () => {
      const mockProvider = {
        create: vi.fn().mockResolvedValue(mockSandbox),
        resume: vi.fn().mockResolvedValue(mockSandbox),
      };
      MockedCreateSandboxProvider.mockReturnValue(mockProvider);

      await geminiAgent.generateCode("test prompt 1");
      await geminiAgent.generateCode("test prompt 2");

      expect(mockProvider.create).toHaveBeenCalledTimes(1);
    });

    it("should use default template when none specified", async () => {
      const configWithoutTemplate = { ...config };
      delete configWithoutTemplate.e2bTemplateId;
      configWithoutTemplate.sandboxConfig = {
        type: "e2b" as const,
        apiKey: "test-e2b-key",
      };

      const mockProvider = {
        create: vi.fn().mockResolvedValue(mockSandbox),
        resume: vi.fn().mockResolvedValue(mockSandbox),
      };
      MockedCreateSandboxProvider.mockReturnValue(mockProvider);

      const agentWithoutTemplate = new GeminiAgent(configWithoutTemplate);
      await agentWithoutTemplate.generateCode("test prompt");

      expect(mockProvider.create).toHaveBeenCalledWith(
        {
          type: "e2b",
          apiKey: "test-e2b-key",
        },
        {
          GEMINI_API_KEY: "test-gemini-key",
          GOOGLE_API_KEY: "test-gemini-key",
        },
        "gemini"
      );
    });
  });

  describe("killSandbox", () => {
    it("should kill the sandbox if it exists", async () => {
      await geminiAgent.generateCode("test prompt");
      await geminiAgent.killSandbox();

      expect(mockSandbox.kill).toHaveBeenCalled();
    });

    it("should not throw error if no sandbox exists", async () => {
      await expect(geminiAgent.killSandbox()).resolves.not.toThrow();
    });
  });

  describe("pauseSandbox", () => {
    it("should pause the sandbox if it exists", async () => {
      await geminiAgent.generateCode("test prompt");
      await geminiAgent.pauseSandbox();

      expect(mockSandbox.pause).toHaveBeenCalled();
    });

    it("should not throw error if no sandbox exists", async () => {
      await expect(geminiAgent.pauseSandbox()).resolves.not.toThrow();
    });
  });

  describe("resumeSandbox", () => {
    it("should resume the sandbox if it exists", async () => {
      const mockProvider = {
        create: vi.fn().mockResolvedValue(mockSandbox),
        resume: vi.fn().mockResolvedValue(mockSandbox),
      };
      MockedCreateSandboxProvider.mockReturnValue(mockProvider);

      await geminiAgent.generateCode("test prompt");
      await geminiAgent.resumeSandbox();

      expect(mockProvider.resume).toHaveBeenCalledWith("test-sandbox-id", {
        type: "e2b",
        apiKey: "test-e2b-key",
        templateId: "vibekit-gemini",
      });
    });

    it("should not throw error if no sandbox exists", async () => {
      await expect(geminiAgent.resumeSandbox()).resolves.not.toThrow();
    });
  });

  describe("generateCode", () => {
    beforeEach(() => {
      const mockProvider = {
        create: vi.fn().mockResolvedValue(mockSandbox),
        resume: vi.fn().mockResolvedValue(mockSandbox),
      };
      MockedCreateSandboxProvider.mockReturnValue(mockProvider);

      mockSandbox.commands.run.mockResolvedValue({
        exitCode: 0,
        stdout: "Test output from gemini command",
        stderr: "",
      });
    });

    it("should execute gemini command with correct parameters", async () => {
      const result = await geminiAgent.generateCode(
        "Create a hello world function"
      );

      // Check that the final command contains the pipe pattern
      const calls = mockSandbox.commands.run.mock.calls;
      const geminiCall = calls.find((call: any) => call[0].includes('| gemini'));
      expect(geminiCall).toBeDefined();
      expect(geminiCall[0]).toContain('echo "');
      expect(geminiCall[0]).toContain('| gemini --model gemini-2.0-flash-exp --yolo');

      expect(result).toMatchObject({
        exitCode: 0,
        stdout: "Test output from gemini command",
        stderr: "",
        sandboxId: "test-sandbox-id",
      });
    });

    it("should use default model when none specified", async () => {
      const configWithoutModel = { ...config };
      delete configWithoutModel.model;
      const agentWithoutModel = new GeminiAgent(configWithoutModel);

      await agentWithoutModel.generateCode("Create a hello world function");

      // Check that the command contains the default model
      const calls = mockSandbox.commands.run.mock.calls;
      const geminiCall = calls.find((call: any) => call[0].includes('| gemini'));
      expect(geminiCall).toBeDefined();
      expect(geminiCall[0]).toContain('| gemini --model gemini-2.5-pro-preview-05-06 --yolo');
    });

    it("should escape special characters in prompts", async () => {
      const promptWithSpecialChars =
        'Create a function with `backticks` and "quotes" and $variables';

      await geminiAgent.generateCode(promptWithSpecialChars);

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        expect.stringContaining(
          '\\`backticks\\` and \\"quotes\\" and \\$variables'
        ),
        expect.objectContaining({
          onStdout: expect.any(Function),
          onStderr: expect.any(Function),
        })
      );
    });

    it("should handle ask mode correctly", async () => {
      await geminiAgent.generateCode("What does this code do?", "ask");

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        expect.stringContaining(
          "Research the repository and answer the user's questions. Do NOT make any changes"
        ),
        expect.objectContaining({
          onStdout: expect.any(Function),
          onStderr: expect.any(Function),
        })
      );
    });

    it("should handle code mode correctly", async () => {
      await geminiAgent.generateCode("Add error handling", "code");

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        expect.stringContaining("Do the necessary changes to the codebase"),
        expect.objectContaining({
          onStdout: expect.any(Function),
          onStderr: expect.any(Function),
        })
      );
    });

    it("should include conversation history in prompt", async () => {
      const history = [
        { role: "user" as const, content: "Previous question" },
        { role: "assistant" as const, content: "Previous answer" },
      ];

      await geminiAgent.generateCode(
        "Follow up question",
        "ask",
        undefined,
        history
      );

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        expect.stringContaining(
          "Conversation history: user\n Previous question\n\nassistant\n Previous answer"
        ),
        expect.objectContaining({
          onStdout: expect.any(Function),
          onStderr: expect.any(Function),
        })
      );
    });

    it("should call streaming callbacks when provided", async () => {
      const onUpdate = vi.fn();
      const onError = vi.fn();
      const callbacks: GeminiStreamCallbacks = { onUpdate, onError };

      await geminiAgent.generateCode(
        "test prompt",
        "code",
        undefined,
        undefined,
        callbacks
      );

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          onStdout: expect.any(Function),
          onStderr: expect.any(Function),
        })
      );
    });

    it("should handle command execution errors", async () => {
      mockSandbox.commands.run.mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "Gemini command failed",
      });

      const result = await geminiAgent.generateCode("test prompt");

      expect(result).toMatchObject({
        exitCode: 1,
        stdout: "",
        stderr: "Gemini command failed",
        sandboxId: "test-sandbox-id",
      });
    });
  });

  describe("getCommandConfig", () => {
    it("should return correct command config for code mode", () => {
      const commandConfig = (geminiAgent as any).getCommandConfig(
        "test prompt",
        "code"
      );

      expect(commandConfig).toMatchObject({
        command: expect.stringContaining(
          "echo \""
        ),
        errorPrefix: "Gemini",
        labelName: "gemini",
        labelColor: "4285F4",
        labelDescription: "Generated by Gemini AI agent",
      });
      expect(commandConfig.command).toContain("| gemini --model gemini-2.0-flash-exp --yolo");
    });

    it("should return correct command config for ask mode", () => {
      const commandConfig = (geminiAgent as any).getCommandConfig(
        "test prompt",
        "ask"
      );

      expect(commandConfig.command).toContain(
        "Research the repository and answer the user's questions"
      );
    });
  });

  describe("getDefaultTemplate", () => {
    it("should return vibekit-gemini as default template", () => {
      const defaultTemplate = (geminiAgent as any).getDefaultTemplate();
      expect(defaultTemplate).toBe("vibekit-gemini");
    });
  });

  describe("getEnvironmentVariables", () => {
    it("should return correct environment variables", () => {
      const envVars = (geminiAgent as any).getEnvironmentVariables();
      expect(envVars).toEqual({
        GEMINI_API_KEY: "test-gemini-key",
        GOOGLE_API_KEY: "test-gemini-key",
      });
    });
  });

  describe("getAgentType", () => {
    it("should return gemini as agent type", () => {
      const agentType = (geminiAgent as any).getAgentType();
      expect(agentType).toBe("gemini");
    });
  });

  describe("getModelConfig", () => {
    it("should return correct model config", () => {
      const modelConfig = (geminiAgent as any).getModelConfig();
      expect(modelConfig).toEqual({
        provider: "gemini",
        apiKey: "test-gemini-key",
        model: "gemini-2.0-flash-exp",
      });
    });

    it("should return config without model when not specified", () => {
      const configWithoutModel = { ...config };
      delete configWithoutModel.model;
      const agentWithoutModel = new GeminiAgent(configWithoutModel);

      const modelConfig = (agentWithoutModel as any).getModelConfig();
      expect(modelConfig).toEqual({
        provider: "gemini",
        apiKey: "test-gemini-key",
        model: undefined,
      });
    });
  });

  describe("edge cases", () => {
    it("should handle empty API key", () => {
      const configWithEmptyKey = { ...config, providerApiKey: "" };
      const agent = new GeminiAgent(configWithEmptyKey);
      expect(agent).toBeInstanceOf(GeminiAgent);
    });

    it("should handle missing API key", () => {
      const configWithoutKey = { ...config };
      delete configWithoutKey.providerApiKey;
      const agent = new GeminiAgent(configWithoutKey);
      expect(agent).toBeInstanceOf(GeminiAgent);
    });

    it("should handle complex prompts with multiple special characters", async () => {
      const complexPrompt = `Create a function that handles:
        - Backticks: \`code\`
        - Quotes: "string" and 'char'
        - Variables: $HOME and \${USER}
        - Backslashes: \\path\\to\\file`;

      await geminiAgent.generateCode(complexPrompt);

      expect(mockSandbox.commands.run).toHaveBeenCalledWith(
        expect.stringContaining("\\`code\\`"),
        expect.any(Object)
      );
    });
  });
});
