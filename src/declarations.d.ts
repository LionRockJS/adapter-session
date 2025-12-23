declare module '@lionrockjs/central' {
  export class Central {
    static config: any;
    static db: any;
    static adapter: any;
  }
  export class ORM {
    static getAsString(type: string, value: any): string;
    static import(name: string, model: any): Promise<any>;
    static readBy(model: any, field: string, value: any[], options: any): Promise<any>;
    static factory(model: any, id: any, options: any): Promise<any>;
    static create(model: any, options: any): any;
  }
  export class HelperCrypto {
    static verify(secret: any, signature: string, data: string): boolean;
    static sign(secret: any, data: string): string;
  }
  export class ControllerMixinDatabase {
    static DATABASES: string;
  }
  export class Model {
    static join(args: any): any;
  }
}

declare module '@lionrockjs/mixin-session' {
  export class AbstractAdapterSession {
    constructor();
    static read(request: any, options: any): Promise<any>;
    static write(request: any, data: any, options: any): Promise<void>;
    static destroy(sid: string): Promise<void>;
    static create(): Promise<any>;
  }
}
