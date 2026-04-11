/**
 * BitWarp Networking server implementation tests
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
/* Import required modules */
import { beforeAll, beforeEach, describe, expect } from 'vitest';
import { BitWarpServer } from '../../src/server';
import { LogLevel, TransportCloseCode } from '../../src/shared';
import { WebSocketServerTransport, WebSocketServerTransportOptions } from '../../src/server/transport/websocket';

/**
 * Describe tests
 */
describe('BitWrap Server Tests', () => {
  let server : BitWarpServer;

  // Before server tests
  beforeAll(() => {
    // Create Server Instance
    server = new BitWarpServer({
      name: "BitWarp Test Server",
      version: "1.0.0",
      debug: true,
      logLevel: LogLevel.Log | LogLevel.Info | LogLevel.Error | LogLevel.Warning | LogLevel.Success,
      transport: new WebSocketServerTransport({
        host: "localhost",
        port: 8080,
        path: "/",
        protocol: "",
        reconnectOptions: {
          autoReconnect: false,
          maxAttempts: 5,
          delay: 2000,
        }
      } as WebSocketServerTransportOptions)
    });
  });

  // Server Tests
  it("Server starting test", async () => {
    // Start Server
    let startServer : boolean = await new Promise(async (resolve) => {
      server.onInitialized.addListener(() => {
        resolve(true);
      })
      server.onInitializationError.addListener(() => {
        resolve(false);
      });
      await server.start();
    });

    // Check Initialization Status
    expect(startServer).to.be.true;
  });

});