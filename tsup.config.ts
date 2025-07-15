import { defineConfig } from 'tsup';

export default defineConfig([
  // Main library build
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
  },
  // CLI build
  {
    entry: ['src/cli/index.ts'],
    format: 'esm',
    outDir: 'dist/cli',
    platform: 'node',
    target: 'node18',
    bundle: true,
    dts: false,
    clean: false,
    sourcemap: true,
    banner: {
      js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
    },
    esbuildOptions(options) {
      options.external = ['@e2b/cli', 'daytona'];
      options.banner = {
        js: 'import { createRequire } from \'module\'; const require = createRequire(import.meta.url);',
      };
    },
  },
]);
