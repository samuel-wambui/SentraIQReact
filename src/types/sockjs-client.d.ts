declare module "sockjs-client" {
  import type { IStompSocket } from "@stomp/stompjs";

  interface SockJSOptions {
    protocolsWhitelist?: string[];
    sessionId?: number | (() => string);
    server?: string;
    transports?: string | string[];
    timeout?: number;
    [key: string]: unknown;
  }

  interface SockJSConstructor {
    new (
      url: string,
      protocols?: string | string[],
      options?: SockJSOptions
    ): IStompSocket;
  }

  const SockJS: SockJSConstructor;
  export default SockJS;
}
