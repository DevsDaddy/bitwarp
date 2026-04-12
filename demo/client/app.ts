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
import { Logger, BaseEvent, ErrorHandler, ErrorType } from '../../dist/';
import { BitWarpClient, BitWarpClientOptions } from '../../dist/client';

/**
 * Demo application client
 */
class Application {
  public onInitialized : BaseEvent<void> = new BaseEvent<void>();
  public onInitializationError : BaseEvent<ErrorHandler> = new BaseEvent<ErrorHandler>();
  public onError : BaseEvent<ErrorHandler> = new BaseEvent<ErrorHandler>();

  // Client Instance
  private readonly _client : BitWarpClient;

  /**
   * Create demo application
   * @param client {BitWarpClient} BitWarp Client instance
   */
  constructor(client ? : BitWarpClient) {
    this._client = (client) ? client : new BitWarpClient();
  }

  // #region Application demo fields
  public get client() : BitWarpClient { return this._client; }
  public get clientOptions() : BitWarpClientOptions { return this.client.options; }
  // #endregion

  // #region Initialization
  public async init(): Promise<void> {
    let self = this;
    if (self.client.isConnected) {
      self.onError.invoke(new ErrorHandler(`Failed to initialize application. BitWarp client is already started`, null, ErrorType.ServerException))
      return;
    }

    // Add Events
    self.client.onStopped.addListener(() => {
      Logger.success(`Application is stopped, because BitWarp Client is stopped.`);
    });
    self.client.onInitializationError.addListener((error)=> {
      // @ts-ignore
      self.onInitializationError.invoke(error)
    });
    self.client.onError.addListener((error)=> {
      // @ts-ignore
      self.onError.invoke(error)
    });
    self.client.onInitialized.addListener(()=> { self.onInitialized.invoke() });
    await self.client.connect();
  }
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
