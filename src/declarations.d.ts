declare module 'jsonwebtoken' {
  export function verify(token: string, secretOrPublicKey: any, options?: any): any;
  export function sign(payload: any, secretOrPrivateKey: any, options?: any): string;
}

declare module '@lionrockjs/central' {
  export class Central {
    static config: any;
    static adapter: any;
  }
}

declare module '@lionrockjs/mixin-session' {
  export class AbstractAdapterSession {
    constructor();
    static read(cookies: any, options: any): Promise<any>;
    static write(session: any, cookies: any[], options: any): Promise<void>;
    static create(): Promise<any>;
  }
}
