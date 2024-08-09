import { Central } from '@lionrockjs/central';
import { randomUUID } from 'node:crypto';
import JWT from 'jsonwebtoken';

import {AbstractHelperSession} from "@lionrockjs/mixin-session";

export default class HelperSessionJWT extends AbstractHelperSession{
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
    const jwt = JWT.sign(request.session, Central.config.session.secret);

    cookies.push({
      name: config.name,
      value: jwt,
      options: Central.config.cookie.options,
    });
  }
}