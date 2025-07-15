import { vi } from "vitest";

// Mock @daytonaio/sdk to prevent ES module compatibility issues
vi.mock("@daytonaio/sdk", () => {
  const MockDaytona = vi.fn().mockImplementation(() => ({
    create: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
  }));

  return {
    Daytona: MockDaytona,
    DaytonaConfig: {},
  };
});

// Mock untildify in case it's used elsewhere
vi.mock("untildify", () => ({
  default: vi.fn((path: string) => path),
}));

// Mock execa for simulating shell commands
vi.mock("execa", () => ({
  execa: vi.fn(),
  execaSync: vi.fn(),
}));

// Mock enquirer for user prompts
vi.mock("enquirer", () => ({
  default: {
    prompt: vi.fn().mockResolvedValue({}),
  },
}));

// Mock fs/promises for file operations
vi.mock("fs/promises", () => ({
  access: vi.fn(),
  copyFile: vi.fn(),
  unlink: vi.fn(),
}));

// Mock ora for spinners
vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    text: "",
  })),
}));

// Mock chalk for colored output
vi.mock("chalk", () => ({
  default: {
    blue: vi.fn((text: string) => text),
    green: vi.fn((text: string) => text),
    red: vi.fn((text: string) => text),
    yellow: vi.fn((text: string) => text),
    gray: vi.fn((text: string) => text),
  },
}));

// Mock open for browser opening
vi.mock("open", () => ({
  default: vi.fn(),
}));

// Mock process.exit to prevent tests from terminating
vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

// Mock console methods for output assertions
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});
