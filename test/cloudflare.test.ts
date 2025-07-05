import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  CloudflareSandboxProvider, 
  CloudflareSandboxInstance,
  createSandboxProvider,
  createSandboxConfigFromEnvironment
} from '../src/services/sandbox';
import { SandboxConfig } from '../src/types';

// Mock Cloudflare SDK
vi.mock('cloudflare', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      workers: {
        scripts: {
          update: vi.fn().mockResolvedValue({}),
          get: vi.fn().mockResolvedValue({}),
          delete: vi.fn().mockResolvedValue({})
        }
      }
    }))
  };
});

// Mock fetch for container communication
global.fetch = vi.fn();

describe('CloudflareSandboxProvider', () => {
  let provider: CloudflareSandboxProvider;
  let mockConfig: SandboxConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new CloudflareSandboxProvider();
    mockConfig = {
      type: 'cloudflare',
      apiToken: 'test-token',
      accountId: 'test-account-id',
      scriptName: 'test-script'
    };
  });

  describe('create', () => {
    it('should create a Cloudflare sandbox instance', async () => {
      const envs = { NODE_ENV: 'test' };
      const agentType = 'claude';

      const instance = await provider.create(mockConfig, envs, agentType);

      expect(instance).toBeInstanceOf(CloudflareSandboxInstance);
      expect(instance.sandboxId).toBe('test-script');
    });

    it('should generate unique script name when not provided', async () => {
      const configWithoutScriptName = {
        ...mockConfig,
        scriptName: undefined
      };

      const instance = await provider.create(configWithoutScriptName, {}, 'claude');

      expect(instance.sandboxId).toMatch(/^vibekit-claude-\d+$/);
    });

    it('should throw error when required config is missing', async () => {
      const invalidConfig = {
        type: 'cloudflare' as const,
        apiToken: undefined,
        accountId: 'test-account-id'
      };

      await expect(provider.create(invalidConfig)).rejects.toThrow(
        'Cloudflare sandbox configuration missing required parameters: apiToken, accountId'
      );
    });
  });

  describe('resume', () => {
    it('should resume an existing sandbox', async () => {
      const sandboxId = 'existing-script';

      const instance = await provider.resume(sandboxId, mockConfig);

      expect(instance).toBeInstanceOf(CloudflareSandboxInstance);
      expect(instance.sandboxId).toBe(sandboxId);
    });

    it('should throw error when config is missing for resume', async () => {
      const invalidConfig = {
        type: 'cloudflare' as const,
        apiToken: undefined,
        accountId: 'test-account-id'
      };

      await expect(provider.resume('test-script', invalidConfig)).rejects.toThrow(
        'Cloudflare sandbox configuration missing required parameters: apiToken, accountId'
      );
    });
  });
});

describe('CloudflareSandboxInstance', () => {
  let instance: CloudflareSandboxInstance;
  let mockCloudflare: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCloudflare = {
      workers: {
        scripts: {
          delete: vi.fn().mockResolvedValue({})
        }
      }
    };
    instance = new CloudflareSandboxInstance(
      mockCloudflare,
      'test-script',
      'test-account',
      'test-script',
      'production'
    );
  });

  describe('commands.run', () => {
    it('should execute commands successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          exitCode: 0,
          stdout: 'Hello World\n',
          stderr: ''
        })
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await instance.commands.run('echo "Hello World"');

      expect(result).toEqual({
        exitCode: 0,
        stdout: 'Hello World\n',
        stderr: ''
      });
    });

    it('should handle command execution errors', async () => {
      const mockResponse = {
        ok: false,
        statusText: 'Internal Server Error'
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await instance.commands.run('invalid-command');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Command execution failed');
    });

    it('should call streaming callbacks when provided', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          exitCode: 0,
          stdout: 'Output text',
          stderr: 'Error text'
        })
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const onStdout = vi.fn();
      const onStderr = vi.fn();

      await instance.commands.run('test command', {
        onStdout,
        onStderr
      });

      expect(onStdout).toHaveBeenCalledWith('Output text');
      expect(onStderr).toHaveBeenCalledWith('Error text');
    });
  });

  describe('kill', () => {
    it('should delete the worker script', async () => {
      await instance.kill();

      expect(mockCloudflare.workers.scripts.delete).toHaveBeenCalledWith(
        'test-script',
        { account_id: 'test-account' }
      );
    });

    it('should handle deletion errors gracefully', async () => {
      mockCloudflare.workers.scripts.delete.mockRejectedValue(new Error('Deletion failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await instance.kill();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to delete Cloudflare worker test-script:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('pause', () => {
    it('should log that pause is not applicable', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await instance.pause();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Pause not applicable for Cloudflare containers - workers auto-scale'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getHost', () => {
    it('should return the worker URL', async () => {
      const host = await instance.getHost(8080);

      expect(host).toBe('https://test-script.test-account.workers.dev');
    });
  });
});

describe('createSandboxProvider', () => {
  it('should create Cloudflare sandbox provider', () => {
    const provider = createSandboxProvider('cloudflare');
    expect(provider).toBeInstanceOf(CloudflareSandboxProvider);
  });
});

describe('createSandboxConfigFromEnvironment', () => {
  it('should create Cloudflare sandbox config from environment', () => {
    const environment = {
      cloudflare: {
        apiToken: 'test-token',
        accountId: 'test-account',
        scriptName: 'test-script'
      }
    };

    const config = createSandboxConfigFromEnvironment(environment, 'claude');

    expect(config).toEqual({
      type: 'cloudflare',
      apiToken: 'test-token',
      accountId: 'test-account',
      image: 'superagentai/vibekit-claude:1.0',
      serviceId: undefined,
      environmentName: undefined,
      scriptName: 'test-script'
    });
  });

  it('should prioritize Cloudflare over other providers', () => {
    const environment = {
      cloudflare: {
        apiToken: 'cf-token',
        accountId: 'cf-account'
      },
      e2b: {
        apiKey: 'e2b-key'
      },
      daytona: {
        apiKey: 'daytona-key'
      }
    };

    const config = createSandboxConfigFromEnvironment(environment);

    expect(config.type).toBe('cloudflare');
    expect(config.apiToken).toBe('cf-token');
  });
});