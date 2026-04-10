/**
 * BitWarp Networking server example
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
/* Import required modules */
import { Logger } from '../../src/shared';
import { BitWarpServer, BitWarpServerOptions } from '../../src/server';

/**
 * Demo application server
 */
class Application {
  private readonly _server : BitWarpServer;

  /**
   * Create demo application
   * @param server {BitWarpServer} BitWarp Server instance
   */
  constructor(server ? : BitWarpServer) {
    this._server = (server) ? server : new BitWarpServer();
  }

  // #region Application demo fields
  public get server() : BitWarpServer { return this._server; }
  public get serverOptions() : BitWarpServerOptions { return this.server.options; }
  // #endregion
}

/**
 * Launch demo application
 */
(async () => {
  // Create application instance
  Logger.head("Welcome to demo application");
  const app = new Application(new BitWarpServer({

  }));
})();