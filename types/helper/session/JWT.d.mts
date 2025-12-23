import { AbstractAdapterSession } from "@lionrockjs/mixin-session";
export default class SessionJWT extends AbstractAdapterSession {
    static read(cookies: Record<string, string>, options: any): Promise<any>;
    static write(session: any, cookies: any[], options: any): Promise<void>;
}
