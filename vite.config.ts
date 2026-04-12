/**
 * BitWarp configuration for demo client
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
/* Import modules */
import { defineConfig } from 'vite';

/**
 * Setup vite config
 */
export default defineConfig({
  root: 'demo/client',
  server: {
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