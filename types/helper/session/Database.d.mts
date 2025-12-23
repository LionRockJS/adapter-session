import { AbstractAdapterSession } from "@lionrockjs/mixin-session";
export default class SessionDatabase extends AbstractAdapterSession {
    static read(request: any, options: any): Promise<any>;
    static write(request: any, cookies: any[], options: any): Promise<void>;
}
