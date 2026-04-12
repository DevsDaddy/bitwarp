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
import { BaseEvent, ErrorHandler, ErrorType, Logger } from '../../src/shared';
import { BitWarpServer, BitWarpServerOptions } from '../../src/server';

/**
 * Demo application server
 */
class Application {
  public onInitialized : BaseEvent<void> = new BaseEvent<void>();
  public onInitializationError : BaseEvent<ErrorHandler> = new BaseEvent<ErrorHandler>();
  public onError : BaseEvent<ErrorHandler> = new BaseEvent<ErrorHandler>();

  // Server Instance
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

  // #region Initialization
  public async init(): Promise<void> {
    let self = this;
    if (self.server.isStarted) {
      self.onError.invoke(new ErrorHandler(`Failed to initialize application. BitWarp server is already started`, null, ErrorType.ServerException))
      return;
    }

    // Add Events
    self.server.onStopped.addListener(() => {
      Logger.success(`Application is stopped, because BitWarp Server is stopped.`);
    });
    self.server.onInitializationError.addListener((error)=> { self.onInitializationError.invoke(error) });
    self.server.onError.addListener((error)=> { self.onError.invoke(error) });
    self.server.onInitialized.addListener(()=> { self.onInitialized.invoke() });
    await self.server.start();
  }
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

  // Add application events
  app.onInitialized.addListener(()=> {
    Logger.success(`Demo application was initialized`);
  })
  app.onInitializationError.addListener((error)=> {
    Logger.error(`Demo application failed with error: ${error?.message ?? "Unknown error"}`);
  });
  app.onError.addListener((error)=> {
    Logger.error(`Application error: ${error?.message ?? "Unknown error"}`);
  });

  // Initialize application
  await app.init();
})();