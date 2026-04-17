/**
 * BitWarp configuration for demo client
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1015
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               17.04.2026
 */
/* Import modules */
import { defineConfig } from 'vite';

/**
 * Setup vite config
 */
export default defineConfig({
  root: 'demo/client',
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
    watch: {
      usePolling: true,
    },
    port: 3000,
    open: true,
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  }
});