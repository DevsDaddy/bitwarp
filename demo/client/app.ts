/**
 * BitWarp Networking client example
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
/* Import required modules */
import { Logger } from '../../dist/';
import { BitWarpClient, BitWarpClientOptions } from '../../dist/client';

/**
 * Demo application client
 */
class Application {
  private readonly _server : BitWarpClient;

  /**
   * Create demo application
   * @param server {BitWarpClient} BitWarp Client instance
   */
  constructor(server ? : BitWarpClient) {
    this._server = (server) ? server : new BitWarpClient();
  }

  // #region Application demo fields
  public get server() : BitWarpClient { return this._server; }
  public get serverOptions() : BitWarpClientOptions { return this.server.options; }
  // #endregion
}

/**
 * Launch demo application
 */
(async () => {
  // Create application instance
  Logger.head("Welcome to demo application");
  const app = new Application(new BitWarpClient({

  }));
})();
