#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));

const program = new Command();

program
  .name('vibekit')
  .description('VibeKit development environment manager')
  .version(packageJson.version);

program
  .command('init')
  .description('Initialize VibeKit providers')
  .action(initCommand);

program.parse(process.argv);