import enquirer from "enquirer";
import chalk from "chalk";
import cfonts from "cfonts";
import { execa } from "execa";
import { installE2B } from "./providers/e2b.js";
import { installDaytona } from "./providers/daytona.js";
import { authenticate, checkAuth, isCliInstalled } from "../utils/auth.js";
import { AGENT_TEMPLATES, SANDBOX_PROVIDERS } from "../../constants/enums.js";

const { prompt } = enquirer;

// Add this type and registry after imports
type InstallConfig = {
  cpu: number;
  memory: number;
  disk: number; // Make required to match Daytona expectations
};

type ProviderInstaller = {
  isInstalled: () => Promise<boolean>;
  configTransform: (config: InstallConfig) => InstallConfig;
  install: (config: InstallConfig, templates: string[]) => Promise<boolean>;
};

const installers: Record<SANDBOX_PROVIDERS, ProviderInstaller> = {
  [SANDBOX_PROVIDERS.E2B]: {
    isInstalled: async () => await isCliInstalled("e2b"),
    configTransform: (config) => config,
    install: installE2B,
  },
  [SANDBOX_PROVIDERS.DAYTONA]: {
    isInstalled: async () => await isCliInstalled("daytona"),
    configTransform: (config) => ({
      ...config,
      memory: Math.floor(config.memory / 1024),
    }),
    install: installDaytona,
  },
};

async function checkDockerStatus(): Promise<{
  isInstalled: boolean;
  isRunning: boolean;
}> {
  try {
    // Check if Docker is installed
    await execa("docker", ["--version"]);

    try {
      // Check if Docker daemon is running
      await execa("docker", ["info"]);
      return { isInstalled: true, isRunning: true };
    } catch {
      return { isInstalled: true, isRunning: false };
    }
  } catch {
    return { isInstalled: false, isRunning: false };
  }
}

export async function initCommand() {
  try {
    // Display banner
    cfonts.say("VIBEKIT", {
      font: "block",
      align: "left",
      colors: ["#FFA500"],
      background: "transparent",
      letterSpacing: 1,
      lineHeight: 1,
      space: true,
      maxLength: "0",
      gradient: false,
      independentGradient: false,
      transitionGradient: false,
      env: "node",
    });

    // Show requirements
    console.log(chalk.blue("🖖 Welcome to VibeKit Setup! 🖖\n"));
    console.log(chalk.yellow("📋 Requirements:"));
    console.log(chalk.gray("  • Internet connection"));
    console.log(chalk.gray("  • Docker installed and running"));
    console.log(chalk.gray("  • Account on at least one sandbox provider\n"));

    // Prompt for provider selection
    console.log(chalk.gray("↑/↓: Navigate • Space: Select • Enter: Confirm\n"));

    const { providers } = await prompt<{ providers: SANDBOX_PROVIDERS[] }>({
      type: "multiselect",
      name: "providers",
      message: "Which providers would you like to set up?",
      choices: Object.entries(SANDBOX_PROVIDERS).map(([key, value]) => ({
        name: value,
        message: value,
      })),
    });

    if (providers.length === 0) {
      console.log(chalk.yellow("No providers selected. Exiting."));
      process.exit(0);
    }

    // Prompt for template selection
    const { templates } = await prompt<{ templates: string[] }>({
      type: "multiselect",
      name: "templates",
      message: "Which agent templates would you like to install?",
      choices: AGENT_TEMPLATES.map((template) => ({
        name: template.name,
        message: template.display,
      })),
    });

    if (templates.length === 0) {
      console.log(chalk.yellow("No templates selected"));
      return;
    }

    // Add this function before the prompts
    function getResourcePrompts(providers: SANDBOX_PROVIDERS[]) {
      const prompts = [
        {
          type: "input",
          name: "cpu",
          message: "CPU cores per provider (Recommended: 2-4 cores):",
          initial: "2",
          validate: (value: string) => {
            const num = parseInt(value);
            return !isNaN(num) && num > 0
              ? true
              : "Please enter a valid number";
          },
        },
        {
          type: "input",
          name: "memory",
          message: "Memory (MB) per provider (Recommended: 1024-4096 MB):",
          initial: "1024",
          validate: (value: string) => {
            const num = parseInt(value);
            return !isNaN(num) && num > 0
              ? true
              : "Please enter a valid number";
          },
        },
      ];

      if (providers.includes(SANDBOX_PROVIDERS.DAYTONA)) {
        prompts.push({
          type: "input",
          name: "disk",
          message: "Disk space (GB) for Daytona (Recommended: 1-3 GB):",
          initial: "1",
          validate: (value: string) => {
            const num = parseInt(value);
            return !isNaN(num) && num > 0
              ? true
              : "Please enter a valid number";
          },
        });
      }

      // Add more conditional prompts for other providers here in the future

      return prompts;
    }

    // Use the function for dynamic prompts
    console.log(
      chalk.gray("\nConfigure resource allocation for your providers:")
    );
    const resourceResponses = await prompt<{
      cpu: string;
      memory: string;
      disk?: string;
    }>(getResourcePrompts(providers));
    const { cpu, memory, disk } = resourceResponses;

    const config = {
      cpu: parseInt(cpu),
      memory: parseInt(memory),
      disk: parseInt(disk ?? "1"), // Default to 1 GB if not prompted
    };

    // Check Docker once upfront since all providers need it
    console.log(chalk.blue("\n🐳 Checking Docker..."));
    const dockerStatus = await checkDockerStatus();
    if (!dockerStatus.isInstalled) {
      console.log(
        chalk.red(
          "❌ Docker not found. Please install Docker from: https://docker.com/get-started and try again. Setup failed: Docker is required for all providers"
        )
      );
      return;
    }

    if (!dockerStatus.isRunning) {
      console.log(
        chalk.red(
          "❌ Docker is not running. Please start Docker and try again. Setup failed: Docker must be running to deploy templates"
        )
      );
      return;
    }

    console.log(chalk.green("✅ Docker is installed and running"));

    // Install selected providers
    let successfulProviders = 0;
    let failedProviders = 0;

    for (const provider of providers) {
      let isAuthenticated = false;

      // Use registry for provider-specific handlers
      const installer = installers[provider];

      // Check if we need to install the CLI first
      const needsInstall = !(await installer.isInstalled());
      if (needsInstall) {
        console.log(chalk.yellow(`\n🔧 ${provider} CLI needs to be installed`));
        const installed = await authenticate(provider);
        if (!installed) {
          console.log(
            chalk.yellow(`\nPlease install ${provider} CLI and try again.`)
          );
          failedProviders++;
          continue; // Skip to next provider
        }
      }

      // Now check authentication
      console.log(chalk.blue(`\n🔐 Checking ${provider} authentication...`));
      const authStatus = await checkAuth(provider);

      if (!authStatus.isAuthenticated) {
        console.log(chalk.yellow(`🔑 Authentication required for ${provider}`));
        const success = await authenticate(provider);
        if (!success) {
          console.log(
            chalk.yellow(
              `\nPlease authenticate with ${provider} and try again.`
            )
          );
          failedProviders++;
          continue; // Skip to next provider
        }

        // Verify authentication after login attempt
        const newAuthStatus = await checkAuth(provider);
        if (!newAuthStatus.isAuthenticated) {
          console.log(chalk.red(`❌ Failed to authenticate with ${provider}`));
          failedProviders++;
          continue; // Skip to next provider
        }
        isAuthenticated = true;
      } else {
        console.log(chalk.green(`✅ Already authenticated with ${provider}`));
        isAuthenticated = true;
      }

      if (!isAuthenticated) {
        failedProviders++;
        continue; // Skip to next provider if not authenticated
      }

      // Proceed with installation (Docker already verified)
      const transformedConfig = installer.configTransform(config);
      const installationSuccess = await installer.install(
        transformedConfig,
        templates
      );

      if (installationSuccess) {
        successfulProviders++;
      } else {
        failedProviders++;
      }
    }

    // Show final result based on success/failure
    if (successfulProviders > 0 && failedProviders === 0) {
      console.log(chalk.green("\n✅ Setup complete!\n"));
    } else if (successfulProviders > 0 && failedProviders > 0) {
      console.log(
        chalk.yellow(
          `\n⚠️  Setup partially complete: ${successfulProviders} succeeded, ${failedProviders} failed\n`
        )
      );
    } else {
      console.log(
        chalk.red(
          "\n❌ Setup failed: No providers were successfully configured\n"
        )
      );
    }
  } catch (error) {
    console.error(
      chalk.red("\n❌ Setup failed:"),
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}
