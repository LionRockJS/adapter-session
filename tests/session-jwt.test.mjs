import * as url from 'node:url';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');
import dotenv from 'dotenv';
dotenv.config({path: path.normalize(__dirname + '/.env')});

import path from 'node:path';
import { Central, Controller } from '@lionrockjs/central';
import {ControllerMixinSession} from '@lionrockjs/mixin-session';
import SessionAdapterJWT from "../dist/helper/session/JWT.mjs";

import JWT from 'jsonwebtoken';

class ControllerSession extends Controller {
  static mixins = [...Controller.mixins, ControllerMixinSession];

  constructor(request, sessionOption) {
    super(request);
    Object.assign(
      this.state.get(ControllerMixinSession.SESSION_OPTIONS),
      sessionOption
    )
  }

  async action_setfoo() {
    const request = this.state.get(Controller.STATE_REQUEST);
    request.session.foo = request.body;
  }

  async action_readfoo() {
    const request = this.state.get(Controller.STATE_REQUEST);
    this.state.set(Controller.STATE_BODY, request.session.foo);
  }
}

class ControllerSessionNoDB extends Controller {
  static mixins = [ControllerMixinSession];

  constructor(request, sessionOption) {
    super(request);
    this.state.set(ControllerMixinSession.SESSION_OPTIONS, sessionOption);
  }
}

describe('Test Session', () => {
  beforeEach(async () => {
    await Central.addConfig(new Map([
      ['cookie', await import('./test1/application/config/cookie.mjs')],
      ['session', await import('./test1/application/config/session.mjs')],
    ]));
    ControllerMixinSession.defaultAdapter = SessionAdapterJWT;
  });

  test('session adapter', async () => {
    expect(ControllerMixinSession.defaultAdapter).toBe(SessionAdapterJWT);
  });

  test('session secret', ()=>{
    expect(process.env.SESSION_SECRET).toBe('shhhhh');
  })

  test('session expire', ()=>{
    expect(Central.config.session.expires).toBe(3600);
  })

  test('no session', async () => {
    const c = new ControllerSession({ cookies: {} });
    const result = await c.execute(null, true);
    const session = c.state.get(Controller.STATE_REQUEST).session;
    expect(session.creator).toBe('SessionJWT');

    // default saveUninitialized false
    expect(result.cookies.length).toBe(0);
  });

  test('config', async()=>{
    expect(process.env.SESSION_SECRET).toBe('shhhhh');
  })

  test('request env session secret has priority', async () => {
    const options = { state: new Map([['request', { env: { SESSION_SECRET: 'worker-secret' } }]]) };
    const session = { ...SessionAdapterJWT.create(), foo: 'worker' };
    const cookies = [];

    await SessionAdapterJWT.write(session, cookies, options);

    const cookie = cookies.find(({ name }) => name === 'lionrock-session');
    expect(!!cookie).toBe(true);
    expect(() => JWT.verify(cookie.value, process.env.SESSION_SECRET)).toThrow();
    expect(JWT.verify(cookie.value, 'worker-secret').foo).toBe('worker');

    const readSession = await SessionAdapterJWT.read({ 'lionrock-session': cookie.value }, options);
    expect(readSession.foo).toBe('worker');
  });

  test('config session secret fallback', async () => {
    const originalSecret = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    Central.config.session.secret = 'config-secret';

    try {
      const session = { ...SessionAdapterJWT.create(), foo: 'config' };
      const cookies = [];

      await SessionAdapterJWT.write(session, cookies, {});

      const cookie = cookies.find(({ name }) => name === 'lionrock-session');
      expect(!!cookie).toBe(true);
      expect(JWT.verify(cookie.value, 'config-secret').foo).toBe('config');
    } finally {
      process.env.SESSION_SECRET = originalSecret;
      delete Central.config.session.secret;
    }
  });

  test('save uninitialized', async () => {
    const c = new ControllerSession({ cookies: {} }, { saveUninitialized: true });
    const result = await c.execute();

    const cookie = result.cookies.find(({ name }) => name === 'lionrock-session');
    expect(!!cookie).toBe(true);
  });

  test('continue session', async () => {
    const c = new ControllerSession({ cookies: {} }, { saveUninitialized: true });
    const result = await c.execute();
    const cookie = result.cookies.find(({ name }) => name === 'lionrock-session');
    console.log(cookie.value);
    const session = JWT.verify(cookie.value, process.env.SESSION_SECRET);
    expect(session.foo).toBe(undefined);

    const data = String(Math.random());

    const c2 = new ControllerSession({ cookies: { 'lionrock-session': cookie.value }, body: data });
    const r2 = await c2.execute('setfoo');
    const cookie2 = r2.cookies.find(({ name }) => name === 'lionrock-session');

    const session2 = JWT.verify(cookie2.value, process.env.SESSION_SECRET);
    expect(session2.foo).toBe(data);

    const c3 = new ControllerSession({ cookies: { 'lionrock-session': cookie2.value } });
    const r3 = await c3.execute('readfoo');

    expect(r3.body).toBe(data);
  });

  test('config, saveUnitialized', async () => {
    Central.config.session.saveUninitialized = false;

    const c = new ControllerSession({ cookies: {} });
    const result = await c.execute();
    expect(result.cookies.length).toBe(0);

    Central.config.session.saveUninitialized = true;

    const c2 = new ControllerSession({ cookies: {} });
    const result2 = await c2.execute();
    if(result2.status === 500)console.error(result2.body);
    expect(result2.status).toBe(200);

    expect(Central.config.session.saveUninitialized).toBe(true);
    const cookie = result2.cookies.find(({ name }) => name === 'lionrock-session');
    expect(!!cookie).toBe(true);
  });

  test('config session name', async () => {
    Central.config.session.name = 'ksession';
    Central.config.session.saveUninitialized = true;
    expect(Central.config.session.name).toBe('ksession');
    expect(Central.config.session.saveUninitialized).toBe(true);
    const config = Central.config.session;

    const c = new ControllerSession({ cookies: {} });
    const result = await c.execute();
    expect(config === Central.config.session).toBe(true);
    expect(Central.config.session.name).toBe('ksession');
    expect(Central.config.session.saveUninitialized).toBe(true);
    const cookie = result.cookies.find(({ name }) => name === 'ksession');
    expect(!!cookie).toBe(true);
  });

  test('config session resave', async () => {
    Central.config.session.resave = false;

    const c = new ControllerSession({ cookies: {}, body: 'hello' });
    const result = await c.execute('setfoo');
    const ssid = result.cookies[0].value;
    const sid = ssid.split('.')[0];

    const c2 = new ControllerSession({ cookies: { 'lionrock-session': ssid }, body: 'hello' });
    const r2 = await c2.execute('setfoo');
    expect(r2.cookies.length).toBe(0);

    Central.config.session.resave = true;
    const c3 = new ControllerSession({ cookies: { 'lionrock-session': ssid }, body: 'hello' });
    expect(Central.config.session.resave).toBe(true);
    const r3 = await c3.execute();
    expect(Central.config.session.resave).toBe(true);

    expect(r3.cookies.length).toBe(1);
  });

  test('invalid session sign', async () => {
    const c1 = new ControllerSession({ cookies: { 'lionrock-session': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImJhciIsInNpZCI6ImZvbyIsImlhdCI6MSwiZm9vIjoid2hhdHN1cCJ9.6Hc-oWRfa2dvhSEKOtKER68LqaLj6DSqTxvIWILaVGg' } });
    const r1 = await c1.execute('readfoo');
//        console.log(r1);
    expect(r1.body).toBe('whatsup');

    const c2 = new ControllerSession({ cookies: { 'lionrock-session': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImJhciIsInNpZCI6ImZvbyIsImlhdCI6MSwiZm9vIjoid2hhdHN1cCJ9.6Hc-oWRfa2dvhSEKOtKER68LqaLj6DSqTxvIWILa' } });
    const r2 = await c2.execute('readfoo');
//        console.log(r2);
    expect(r2.body).toBe("Cannot read properties of undefined (reading 'cookie')");

    const c3 = new ControllerSession({ cookies: { 'lionrock-session': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImJhciIsInNpZCI6ImZvbyIsImlhdCI6MSwiZm9vIjoid2hhdHN1cCJ9.6Hc-oWRfa2dvhSEKOtKER68LqaLj6DSqTxvIWILaVGg' } });
    const r3 = await c3.execute('readfoo');
    //    console.log(r3);
    expect(r3.body).toBe('whatsup');
  });

  test('valid session signature, but session not in database', async () => {
    const data = Math.random();
    const c1 = new ControllerSession({ cookies: { 'lionrock-session': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmb28iOiJiYXIiLCJpYXQiOjF9.Emd3zDa7-3QKdS4HHEhNuf68vricPVNd9TtvmZ8oAWw' }, body: data });
    const r1 = await c1.execute('setfoo');
    expect(r1.cookies.length).toBe(1);
  });

  test('no request cookie', async () => {
    try {
      const c1 = new ControllerSession({});
      await c1.execute();
      expect('this line should not be run').toBe(true);
    } catch (e) {
      expect(true).toBe(true);
    }
  });

  test('no database loaded', async () => {
    try {
      const c1 = new ControllerSessionNoDB({ cookies: {} });
      await c1.execute();
      expect('this line should not be run').toBe(true);
    } catch (e) {
      expect(true).toBe(true);
    }
  });

  test('request session assigned', async () => {
    const c1 = new ControllerSession({ cookies: {}, session: {} });
    await c1.execute();
  });

  test('db-backed jti can revoke access token', async () => {
    const secret = '01234567890123456789012345678901';
    const jtiBySid = new Map();
    const cookies = [];
    const options = {
      secret,
      minimumSecretLength: 32,
      jti: {
        enabled: true,
        tokenUse: 'access',
        persist: async ({ jti, session }) => {
          jtiBySid.set(session.sid, jti);
        },
        verify: async ({ jti, session }) => jtiBySid.get(session.sid) === jti,
      },
    };
    const session = {
      ...SessionAdapterJWT.create(),
      foo: 'bar',
    };

    await SessionAdapterJWT.write(session, cookies, options);

    const accessCookie = cookies.find(({ name }) => name === 'lionrock-session');
    expect(!!accessCookie).toBe(true);

    const firstRead = await SessionAdapterJWT.read({ 'lionrock-session': accessCookie.value }, options);
    expect(firstRead.foo).toBe('bar');

    jtiBySid.set(session.sid, 'revoked');

    await expect(SessionAdapterJWT.read({ 'lionrock-session': accessCookie.value }, options)).rejects.toThrow('JWT session jti is invalid or revoked.');
  });

  test('db-backed jti rotates with refresh token', async () => {
    const secret = 'abcdefghijklmnopqrstuvwxyz123456';
    const jtiBySid = new Map();
    const issueState = new Map([
      ['cookies', []],
      ['request', { env: {} }],
    ]);
    const issueOptions = {
      secret,
      minimumSecretLength: 32,
      refreshToken: {
        enabled: true,
        rotate: true,
        expires: 60 * 60,
      },
      accessToken: {
        expires: 60,
      },
      jti: {
        enabled: true,
        tokenUse: 'refresh',
        persist: async ({ jti, session }) => {
          jtiBySid.set(session.sid, jti);
        },
        verify: async ({ jti, session }) => jtiBySid.get(session.sid) === jti,
      },
      state: issueState,
    };
    const session = {
      ...SessionAdapterJWT.create(),
      foo: 'refresh-ok',
    };
    const writeCookies = [];

    await SessionAdapterJWT.write(session, writeCookies, issueOptions);

    const refreshCookie = writeCookies.find(({ name }) => name === 'lionrock-session-refresh');
    expect(!!refreshCookie).toBe(true);

    const oldRefreshPayload = JWT.verify(refreshCookie.value, secret);
    const oldRefreshJti = oldRefreshPayload.jti;

    const readState = new Map([
      ['cookies', []],
      ['request', { env: {} }],
    ]);
    const readOptions = {
      ...issueOptions,
      state: readState,
    };
    const refreshedSession = await SessionAdapterJWT.read({
      'lionrock-session-refresh': refreshCookie.value,
    }, readOptions);

    expect(refreshedSession.foo).toBe('refresh-ok');

    const queuedCookies = readState.get('cookies');
    const rotatedRefreshCookie = queuedCookies.find(({ name }) => name === 'lionrock-session-refresh');
    expect(!!rotatedRefreshCookie).toBe(true);

    const newRefreshPayload = JWT.verify(rotatedRefreshCookie.value, secret);
    expect(newRefreshPayload.jti).not.toBe(oldRefreshJti);
    expect(jtiBySid.get(session.sid)).toBe(newRefreshPayload.jti);
  });

  test('delete expired sessions', async () => {
    // set dummy data
    // create a session
    // select data should be deleted.
  });
});
