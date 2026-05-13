import { AbstractAdapterSession } from "@lionrockjs/mixin-session";
type SessionData = {
    id: string | null;
    sid: string;
    creator: string;
    [key: string]: any;
};
export default class SessionJWT extends AbstractAdapterSession {
    static read(cookies: Record<string, string>, options: any): Promise<SessionData>;
    static write(session: SessionData, cookies: any[], options: any): Promise<void>;
}
export {};
