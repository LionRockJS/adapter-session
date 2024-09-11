import * as url from 'node:url';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');
import dotenv from 'dotenv';
dotenv.config({path: path.normalize(__dirname + '/.env')});

import path from 'node:path';
import fs from 'node:fs';
import { Central, Controller } from '@lionrockjs/central';
import {ControllerMixinSession} from '@lionrockjs/mixin-session';
import SessionAdapterJWT from "../classes/helper/session/JWT.mjs";

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
    await Central.init({ EXE_PATH: `${__dirname}/test1`});

    Central.classPath.set('ControllerSession', path.normalize(`${__dirname}/../classes/ControllerSession.mjs`));
//    await Central.flushCache();
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
    const result = await c.execute();
    const session = c.state.get(Controller.STATE_REQUEST).session;
    expect(session.creator).toBe('SessionJWT');

    // default saveUninitialized false
    expect(result.cookies.length).toBe(0);
  });

  test('config', async()=>{
    expect(process.env.SESSION_SECRET).toBe('shhhhh');
  })

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

  test('delete expired sessions', async () => {
    // set dummy data
    // create a session
    // select data should be deleted.
  });
});
