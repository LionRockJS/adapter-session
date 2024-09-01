import { randomUUID } from 'node:crypto';
import JWT from 'jsonwebtoken';

import { AbstractAdapterSession } from "@lionrockjs/mixin-session";
import { Central } from '@lionrockjs/central';

export default class SessionJWT extends AbstractAdapterSession{
  static async read(request, options) {
    const config = { ...Central.config.session, ...options };
    if(!request.cookies[config.name])return this.create();

    try{
      return JWT.verify(request.cookies[config.name], Central.config.session.secret);
    }catch(e){
      return this.create();
    }
  }

  static async write(request, cookies, options) {
    const config = { ...Central.config.session, ...options };
    if(!request.session.id)request.session.id = randomUUID();
    const expire = Central.config.session.expires;

    const data = Object.assign({}, request.session, { exp: Math.floor(Date.now() / 1000) + expire});
    const jwt = JWT.sign(data, Central.config.session.secret);

    cookies.push({
      name: config.name,
      value: jwt,
      options: Central.config.cookie.options,
    });
  }
}