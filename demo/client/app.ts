/**
 * BitWarp Networking client example
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1021
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               19.04.2026
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
    self.client.onHandshakeStarted.addListener(()=>{
      self.setLabel("loading_state", "Encryption establish...");
    });
    self.client.onHandshakeComplete.addListener(()=>{
      self.setLabel("loading_state", "Initialized.");
      self.onInitialized.invoke();
    });
    self.client.onStopped.addListener(() => {
      self.updateStatusBar();
      self.toggleLayout("app_content", false);
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
    self.client.onInitialized.addListener(()=> {
      self.updateStatusBar();
      self.setLabel("loading_state", "Connected. Wait for handshake...");
    });
    self.client.onPingChanged.addListener((ping)=> {
      self.setLabel("ping", `(Ping: ${ping} ms)`);
    });
    self.client.onReconnecting.addListener((isReconnecting)=> {
      if(isReconnecting) self.setLabel("ping", "");
      self.updateStatusBar();
      self.setLabel("loading_state", isReconnecting ? "Reconnecting..." : "Reconnected. Wait for handshake...");
      self.toggleLoader(isReconnecting);
      self.toggleLayout("app_content", isReconnecting);
    });
    await self.client.connect();
  }
  // #endregion

  // #region Components
  /**
   * Set label value
   * @param id {string} Label id
   * @param value {string} Label text
   */
  public setLabel(id : string, value : string) {
    let label = document.querySelectorAll(`[data-label="${id}"]`);
    if (label) {
      label.forEach((item) => {
        item.innerHTML = value;
      });
    }
  }

  /**
   * Toggle loader
   * @param isEnabled {boolean} is enabled
   */
  public toggleLoader(isEnabled: boolean) {
    let loader = document.getElementById('preloader');
    if (loader) {
      loader.classList.toggle("hidden", !isEnabled);
    }
  }

  /**
   * Update status bar
   */
  public updateStatusBar(){
    let self = this;

    // Online status
    document.querySelectorAll('.online_icon').forEach((item) => {
      item.classList.toggle('online', self.client.isConnected);
      item.classList.toggle('offline', !self.client.isConnected);
    })
    self.setLabel("connection", self.client.isConnected ? "Connected" : "Offline");
  }

  /**
   * Toggle layout
   * @param layout {string} layout id
   * @param isEnabled {boolean} is enabled
   */
  public toggleLayout(layout: string, isEnabled: boolean) {
    document.querySelectorAll(`[data-layout="${layout}"]`).forEach((item) => {
      item.classList.toggle('hidden', !isEnabled);
    });
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
    cryptoProvider: false
  }));

  // Add application events
  app.updateStatusBar();
  app.toggleLoader(true);
  app.toggleLayout("app_content", false);
  app.setLabel("loading_state", "Initializing...");
  app.onInitialized.addListener(()=> {
    Logger.success(`Demo application was initialized`);
    app.toggleLoader(false);
    app.updateStatusBar();
    app.toggleLayout("app_content", true);
  })
  app.onInitializationError.addListener((error)=> {
    app.setLabel("loading_state", "Initialization Error");
    Logger.error(`Demo application failed with error: ${error?.message ?? "Unknown error"}`);
    app.updateStatusBar();
    // TODO: Show Error Layout
  });
  app.onError.addListener((error)=> {
    Logger.error(`Application error: ${error?.message ?? "Unknown error"}`);
    app.updateStatusBar();
    // TODO: Show Error Layout
  });

  // Initialize application
  await app.init();
})();
