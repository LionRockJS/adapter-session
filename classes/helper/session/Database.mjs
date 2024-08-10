import {Central, ORM, HelperCrypto, ControllerMixinDatabase} from '@lionrockjs/central';
import { AbstractAdapterSession } from "@lionrockjs/mixin-session";

import DefaultSession from '../../model/Session.mjs';
const Session = await ORM.import('Session', DefaultSession);

export default class SessionDatabase extends AbstractAdapterSession{
  static async read(request, options) {
    const config = { ...Central.config.session, ...options };
    if(!request.cookies[config.name])return this.create();

    const database = options.state.get(ControllerMixinDatabase.DATABASES).get('session');
    const signedSessionID = request.cookies[config.name];
    const seg = signedSessionID.split('.');
    const sid = seg[0];
    const sign = seg[1];
    const verify = await HelperCrypto.verify(config.secret, sign, sid);

    if (!verify) {
      return this.create();
    }

    const model = await ORM.readBy(Session, 'sid', [sid], { database });

    // sid not in database, create new session.
    if (!model?.id) {
      return { id:null, sid};
    }

    return { id: model.id, sid: model.sid, ...JSON.parse(model.sess) };
  }

  static async write(request, cookies, options) {
    const config = { ...Central.config.session, ...options };

    const database = options.state.get(ControllerMixinDatabase.DATABASES).get('session');

    const cookieConfig = Central.config.cookie;
    const { secret } = config;
    const model = request.session.id ?
      await ORM.factory(Session, request.session.id, {database}):
      ORM.create(Session, { database });

    const data = { ...request.session };
    model.sid = data.sid;
    delete data.sid;
    delete data.id;

    model.expired = Date.now() + (cookieConfig.options.maxAge ?? 43200000);
    model.sess = JSON.stringify(data);
    await model.write();

    const sign = await HelperCrypto.sign(secret, model.sid);
    const cookieName = `${model.sid}.${sign}`;

    //if session cookie is same, no need to set cookie
    if(!request.session.id)request.session.id = model.id;

    cookies.push({
      name: config.name,
      value: cookieName,
      options: cookieConfig.options,
    });
  }
}