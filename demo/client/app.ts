/**
 * BitWarp Networking client example
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1045
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               21.04.2026
 */
/* Import required modules */
import { Logger, BaseEvent, ErrorHandler, ErrorType } from '../../dist/';
import { BitWarpClient, BitWarpClientOptions } from '../../dist/client';

/* Toast type */
type ToastType = 'success' | 'info' | 'warning' | 'error';

/**
 * Demo application client
 */
class Application {
  public onInitialized : BaseEvent<void> = new BaseEvent<void>();
  public onInitializationError : BaseEvent<ErrorHandler> = new BaseEvent<ErrorHandler>();
  public onError : BaseEvent<ErrorHandler> = new BaseEvent<ErrorHandler>();

  // Client Instance
  private readonly _client : BitWarpClient;
  private _isToastSetup : boolean = false;
  protected isPeerSetup : boolean = false;

  // Routes
  private readonly routes : object = {
    welcome : this.onWelcome,
    create_room : this.onCreateRoomRequested,
    peer_info: this.onUpdatePeerRequested
  };

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

    // Add tooltips
    self.toggleComponent("slow_network_icon", false);
    self.setupTooltips();

    // Add Events
    self.client.onHandshakeStarted.addListener(()=>{
      self.setLabel("loading_state", "Encryption establish...");
      self.isPeerSetup = false;
    });
    self.client.onHandshakeComplete.addListener(async ()=>{
      self.setLabel("loading_state", "Initialized.");
      await self.onInitialized.invokeAsync();

      // Has crypto provider
      self.showToast(
        (self.client.options.cryptoProvider) ? "success" : "warning",
        (self.client.options.cryptoProvider) ? "Secured connection" : "Unsafe connection",
        (self.client.options.cryptoProvider) ? "Your connection are secured now" : "This server doesn't support a secured connection.");
    });
    self.client.onStopped.addListener(() => {
      self.updateStatusBar();
      self.toggleLayout("app_content", false);
      Logger.success(`Application is stopped, because BitWarp Client is stopped.`);
      self.showToast("warning", "Disconnected", "Your connection was stopped");
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
      self.toggleComponent("slow_network_icon", ping >= 50);
    });
    self.client.onReconnecting.addListener((isReconnecting)=> {
      if(isReconnecting) self.setLabel("ping", "");
      self.updateStatusBar();
      self.setLabel("loading_state", isReconnecting ? "Reconnecting..." : "Reconnected. Wait for handshake...");
      self.toggleLoader(isReconnecting);
      self.toggleLayout("app_content", !isReconnecting);
    });
    await self.client.connect();
  }
  // #endregion

  // #region Controllers
  /**
   * On welcome page navigated
   * @param app {Application} Application instance
   */
  public onWelcome(app : Application) : void {
    // Check peer setup
    if(!app.isPeerSetup) {
      app.showView("peer_info");
      return;
    }

    // Set header
    Logger.head("Switched to welcome view");

    // Get form elements
    let roomInput = document.getElementById("room_code") as HTMLInputElement;
    let joinRoomBtn = document.getElementById("join_room") as HTMLButtonElement;
    let createRoomBtn = document.getElementById("create_room") as HTMLButtonElement;
    if(!roomInput || !createRoomBtn || !joinRoomBtn) {
      app.onError.invoke(new ErrorHandler(`Failed to initialize welcome view. Not all form presented`));
    }

    // Input function
    function onRoomInput(event: Event){
      const target = event.target as HTMLInputElement;
      joinRoomBtn.disabled = (target.value.length < 1);
    }

    // Join room
    function onJoinPressed(){
      let roomId = roomInput.value;
      roomInput.value = "";
      joinRoomBtn.disabled = true;
      createRoomBtn.disabled = true;
      app.joinRoom(app, roomId, ()=>{
        Logger.success(`Room joined: ${roomId}`);
      }, error => {
        app.showToast("error", "Error", `Failed to join room: ${error?.message ?? "Unknown error"}`);
      });
    }

    // Create room
    function onCreatePressed(){
      app.showView("create_room");
    }

    // Setup form
    roomInput.value = '';
    roomInput?.focus();
    joinRoomBtn.disabled = true;
    createRoomBtn.disabled = false;
    roomInput.removeEventListener("input", onRoomInput);
    roomInput.addEventListener("input", onRoomInput);
    joinRoomBtn.removeEventListener("click", onJoinPressed);
    joinRoomBtn.addEventListener("click", onJoinPressed);
    createRoomBtn.removeEventListener("click", onCreatePressed);
    createRoomBtn.addEventListener("click", onCreatePressed);
  }

  /**
   * On update peer info requested
   * @param app {Application} Application instance
   */
  public onUpdatePeerRequested(app : Application) : void {
    function onUpdated() { app.showView("welcome"); }
    function onUpdateError(error : ErrorHandler) {
      localStorage.removeItem("username");
      app.showToast("error", "Error", `Failed to join room: ${error?.message ?? "Unknown error"}`);
      app.onUpdatePeerRequested(app);
    }

    // If has in localstorage
    let username = localStorage.getItem("username");
    if(username && username.length > 0){
      app.changePeerName(app, username, onUpdated, onUpdateError);
      return;
    }

    // Set header
    Logger.head("Switched to peer setup view");

    // Get elements
    let nameInput = document.getElementById("peer_name") as HTMLInputElement;
    let updateBtn = document.getElementById("change_info") as HTMLButtonElement;

    // Input function
    function onNameInput(event: Event){
      const target = event.target as HTMLInputElement;
      updateBtn.disabled = (target.value.length < 1);
    }

    // Save pressed
    function onSavePressed(){
      let roomId = nameInput.value;
      nameInput.value = "";
      updateBtn.disabled = true;
      app.changePeerName(app, roomId, onUpdated, onUpdateError);
    }

    // Setup form
    nameInput.value = '';
    nameInput?.focus();
    updateBtn.disabled = true;
    nameInput.removeEventListener("input", onNameInput);
    nameInput.addEventListener("input", onNameInput);
    updateBtn.removeEventListener("click", onSavePressed);
    updateBtn.addEventListener("click", onSavePressed);
  }

  /**
   * On room creation requested
   * @param app {Application} Application instance
   */
  public onCreateRoomRequested(app : Application){

  }
  // #endregion

  // #region Peers Logic
  private changePeerName(app : Application, peerName : string, onComplete ? : () => void, onError ? : (handler : ErrorHandler) => void) : void {
    Logger.info(`Trying to set current username to ${peerName}`);

    function onChanged(info : any){
      if(info?.username && info?.username.length > 0){
        localStorage.setItem("username", info.username);
        app.isPeerSetup = true;
        onComplete && onComplete();
      }else{
        onError && onError(new ErrorHandler(`Failed to change peer name. Response doesn't contains a new username`));
      }
    }

    // Catch errors and complete
    app.client.onPeerInfoUpdated.removeListener(onChanged);
    app.client.onPeerInfoUpdated.addListener(onChanged);

    // Update peer info
    app.client.updatePeerInfo({
      username: peerName
    }).then(() => {}).catch((error : any) => { if(onError) onError(ErrorHandler.parse(error)); });
  }
  // #endregion Peers Logic

  // #region Rooms Logic
  private joinRoom(app : Application, roomId : string, onComplete ? : () => void, onError ? : (handler : ErrorHandler) => void) : void {

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

    // URL
    let transportURL = self.client.transport?.url ?? "ws://localhost/";
    self.setLabel("url", self.getFormattedUrl(transportURL));

    // Secured / Compressed icons
    let isSecured = (self.client.options.cryptoProvider) ? true : false;
    let isCompressed = (self.client.options.compression) ? true : false;
    self.toggleComponent("secured_icon", isSecured);
    self.toggleComponent("unsecured_icon", !isSecured);
    self.toggleComponent("compressed_icon", isCompressed);
    self.toggleComponent("uncompressed_icon", !isCompressed);
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

  /**
   * Toggle component
   * @param component {string} component id
   * @param isEnabled {boolean} is enabled
   */
  public toggleComponent(component: string, isEnabled: boolean) {
    document.querySelectorAll(`[data-component="${component}"]`).forEach((item) => {
      item.classList.toggle('hidden', !isEnabled);
    });
  }

  /**
   * Show view
   * @param viewId {string} View ID
   */
  public showView(viewId : string){
    let self = this;

    // Show / Hide views
    document.querySelectorAll(`[data-view]`).forEach((view) => {
      let vid = view.getAttribute('data-view');
      view.classList.toggle("hidden", (!(vid && vid === viewId)));
    });

    // Launch Controller
    if(self.routes.hasOwnProperty(viewId)){
      // @ts-ignore
      self.routes[viewId](self);
    }
  }

  /**
   * Get formatted URL
   * @param url {string} url
   * @param removeParams {boolean} remove params
   * @returns {string} formatted url
   */
  public getFormattedUrl(url : string, removeParams : boolean = true) : string{
    let green = "<span class='font-green font-bold'>";
    let orange = "<span class='font-orange font-bold'>";
    let end = "</span>"
    if(url.startsWith("http://")) url = url.replace("http://", `${orange}http://${end}`);
    if(url.startsWith("ws://")) url = url.replace("ws://", `${orange}ws://${end}`);
    if(url.startsWith("https://")) url = url.replace("https://", `${green}https://${end}`);
    if(url.startsWith("wss://")) url = url.replace("wss://", `${green}wss://${end}`);
    if(removeParams) {
      url = url.split("?")?.[0] ?? url;
    }
    return url;
  }

  /**
   * Show toast
   * @param type {ToastType} Toast type
   * @param title {string} Toast title
   * @param message {string} Toast message
   * @param onClick {Function} Callback function
   */
  public showToast(type : ToastType, title : string, message : string, onClick ? : Function){
    let self = this;

    if(!self._isToastSetup){
      // @ts-ignore
      toastr.options = {
        "closeButton": true,
        "debug": false,
        "newestOnTop": true,
        "progressBar": true,
        "positionClass": (window.innerWidth <= 768) ? "toast-bottom-full-width" : "toast-bottom-right",
        "preventDuplicates": false,
        "onclick": onClick ?? null,
        "showDuration": "300",
        "hideDuration": "300",
        "timeOut": "5000",
        "extendedTimeOut": "1000",
        "showEasing": "swing",
        "hideEasing": "linear",
        "showMethod": "fadeIn",
        "hideMethod": "fadeOut"
      };

      self._isToastSetup = true;

      // Resize window
      function redraw(){
        self._isToastSetup = false;
        // @ts-ignore
        toastr.remove();
      }

      window.removeEventListener("resize", redraw);
      window.addEventListener("resize", redraw);
    }

    // @ts-ignore
    toastr[type](message, title);
  }

  // Setup tooltips
  private setupTooltips(){
    // @ts-ignore
    tippy('#secured_connection', { content: 'Secured (encrypted) connection', });
    // @ts-ignore
    tippy('#unsecured_connection', { content: 'Unsecured connection', });
    // @ts-ignore
    tippy('#compressed_connection', { content: 'Compression enabled', });
    // @ts-ignore
    tippy('#uncompressed_connection', { content: 'Uncompressed connection', });
    // @ts-ignore
    tippy('#server_url', { content: 'Connection url', });
    // @ts-ignore
    tippy('#slow_network', { content: 'Slow network connection', });
  }
  // #endregion

  // #region healthcheck
  public async healthcheck(app : Application) : Promise<void> {
    try{
      let health = await app.client.callServerCommand("health", {}, true);
      if(!health){
        app.onError.invoke(new ErrorHandler("Healthcheck failed. No data response from server."))
        return;
      }

      Logger.info(`Healthcheck complete`, health);
    }catch(error : any){
      app.onError.invoke(ErrorHandler.parse(error));
    }
  }
  // #endregion
}

/**
 * Launch demo application
 */
(async () => {
  // Create application instance
  Logger.head("Welcome to demo application");
  const app = new Application(new BitWarpClient());

  // Add application events
  app.updateStatusBar();
  app.toggleLoader(true);
  app.toggleLayout("app_content", false);
  app.setLabel("loading_state", "Initializing...");
  app.onInitialized.addListener(async ()=> {
    Logger.success(`Demo application was initialized`);
    app.toggleLoader(false);
    app.updateStatusBar();
    app.toggleLayout("app_content", true);
    app.showView("welcome");

    // Add healthcheck command
    await app.healthcheck(app);
    setInterval(async ()=> {
      await app.healthcheck(app);
    }, 10000);
  })
  app.onInitializationError.addListener((error)=> {
    app.setLabel("loading_state", "Initialization Error");
    Logger.error(`Demo application failed with error: ${error?.message ?? "Unknown error"}`);
    app.updateStatusBar();
  });
  app.onError.addListener((error)=> {
    Logger.error(`Application error: ${error?.message ?? "Unknown error"}`);
    app.updateStatusBar();
    app.showToast("error", "Error", `Application error: ${error?.message ?? "Unknown error"}`);
  });

  // Initialize application
  await app.init();
})();
