/**
 * BitWarp configuration for tsup
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
/* Import required modules */
import { defineConfig } from 'tsup';

/**
 * Configure tsup
 */
export default defineConfig([
  // General Library
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    external: ['node:net', 'node:crypto', 'node:zlib', 'node:events'],
  },
  // Basic client in ESM/CJS (for bundlers)
  {
    entry: {
      index: 'src/client/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: false,
    sourcemap: true,
    platform: 'browser',
  },
  // IIFE-bundle for browsers (using window.BitWarp)
  {
    entry: {
      'bitwarp.iife': 'src/client/index.ts',
    },
    format: ['iife'],
    globalName: 'BitWarp',
    outExtension() {
      return { js: '.js' };
    },
    clean: false,
    sourcemap: true,
    minify: true,
    platform: 'browser',
    target: 'es2020',
    noExternal: [/.*/],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  },
  // Server (only Node.js)
  {
    entry: {
      server: 'src/server/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: false,
    sourcemap: true,
    platform: 'node',
    external: ['node:net', 'node:crypto', 'node:zlib', 'node:events'],
  }
]);