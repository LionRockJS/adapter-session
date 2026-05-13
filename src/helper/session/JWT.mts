import { randomUUID } from 'node:crypto';
import JWT from 'jsonwebtoken';

import { AbstractAdapterSession } from "@lionrockjs/mixin-session";
import { Central } from '@lionrockjs/central';

type SessionData = {
  id: string | null;
  sid: string;
  creator: string;
  [key: string]: any;
};

export default class SessionJWT extends AbstractAdapterSession {
  static async read(cookies: Record<string, string>, options: any): Promise<SessionData> {
    const config = { ...Central.config.session, ...options };
    if(!cookies[config.name]) return this.create();

    const decoded = JWT.verify(cookies[config.name], Central.runtime.process().env.SESSION_SECRET);
    if(typeof decoded !== 'object' || !decoded) return this.create();

    return {
      ...this.create(),
      ...decoded,
    } as SessionData;
  }

  static async write(session: SessionData, cookies: any[], options: any): Promise<void> {
    const config = { ...Central.config.session, ...options };
    if(!session.id) session.id = randomUUID();
    const expire = Central.config.session.expires;

    const data = Object.assign({}, session, { exp: Math.floor(Date.now() / 1000) + expire});
    const jwt = JWT.sign(data, Central.runtime.process().env.SESSION_SECRET);

    cookies.push({
      name: config.name,
      value: jwt,
      options: Central.config.cookie.options,
    });
  }
}
