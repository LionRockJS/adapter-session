import * as url from 'node:url';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');

import path from 'node:path';
import fs from 'node:fs';
import { Central, ControllerMixinDatabase } from '@lionrockjs/central';
import { DatabaseAdapterBetterSQLite3 } from '@lionrockjs/adapter-database-better-sqlite3';
ControllerMixinDatabase.defaultAdapter = DatabaseAdapterBetterSQLite3;
import { Controller } from '@lionrockjs/mvc';
import {ControllerMixinSession} from '@lionrockjs/mixin-session';
import Database from "better-sqlite3";

class ControllerSession extends Controller {
  static mixins = [...Controller.mixins, ControllerMixinDatabase, ControllerMixinSession];

  constructor(request, sessionOption) {
    super(request);
    Object.assign(this.state.get(ControllerMixinSession.SESSION_OPTIONS), sessionOption);
    this.state.get(ControllerMixinDatabase.DATABASE_MAP).set('session', `${__dirname}/test2/database/session.sqlite`);
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
  const dbPath = path.normalize(`${__dirname}/test2/database/session.sqlite`);
  if (fs.existsSync(dbPath))fs.unlinkSync(dbPath);
  fs.copyFileSync(`${__dirname}/defaultDB/session.sqlite`, dbPath);

  beforeEach(async () => {
    await Central.init({ EXE_PATH: `${__dirname}/test2` });
    await Central.initConfig(new Map([
      ['cookie', (await import('../config/cookie.mjs')).default],
      ['session', (await import('../config/session.mjs')).default],
    ]));
    Central.classPath.set('ControllerSession', path.normalize(`${__dirname}/../classes/ControllerSession.mjs`));
//    await Central.flushCache();
  });

  test('no session', async () => {
    const c = new ControllerSession({ cookies: {} });
    const result = await c.execute();
    // default saveUninitialized false
    expect(result.cookies.length).toBe(0);
  });

  test('session created', async () => {
    const c = new ControllerSession({ cookies: {} }, { saveUninitialized: true });
    const result = await c.execute();
    const request = c.state.get(Controller.STATE_REQUEST);
    expect(typeof request.session).toBe('object');
  });

  test('save uninitialized', async () => {
    const c = new ControllerSession({ cookies: {} }, { saveUninitialized: true });
    const result = await c.execute();

    const cookie = result.cookies.find(({ name }) => name === 'lionrock-session');
    console.log(result.cookies);
    expect(!!cookie).toBe(true);

    const ssid = cookie.value;
    const sid = ssid.split('.')[0];

    const record = c.state.get('databases').get('session').prepare('SELECT * FROM sessions where sid = ?').get(sid);
    expect(!!record).toBe(true);
  });

  test('continue session', async () => {
    const c = new ControllerSession({ cookies: {} }, { saveUninitialized: true });
    const result = await c.execute();
    const cookie = result.cookies.find(({ name }) => name === 'lionrock-session');

    const ssid = cookie.value;
    const data = String(Math.random());

    const c2 = new ControllerSession({ cookies: { 'lionrock-session': ssid }, body: data });
    const r2 = await c2.execute('setfoo');
    expect(r2.body).toBe('');

    const db = new Database(`${__dirname}/test2/database/session.sqlite`);
    const sid = ssid.split('.')[0];
    const row = db.prepare('SELECT * FROM sessions WHERE sid = ?').get(sid);
    expect(row.sess).toBe('{"foo":"'+data+'"}');

    const c3 = new ControllerSession({ cookies: { 'lionrock-session': ssid } });
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

    const record = c.state.get(ControllerMixinDatabase.DATABASES).get('session').prepare('SELECT * FROM sessions where sid = ?').get(sid);
    expect(record.sess).toBe('{"foo":"hello"}');
    const lastUpdate = record.expired;

    const c2 = new ControllerSession({ cookies: { 'lionrock-session': ssid }, body: 'hello' });
    const r2 = await c2.execute('setfoo');
    expect(r2.cookies.length).toBe(0);

    const record2 = c.state.get(ControllerMixinDatabase.DATABASES).get('session').prepare('SELECT * FROM sessions where sid = ?').get(sid);
    expect(record2.expired).toBe(lastUpdate);

    Central.config.session.resave = true;
    const c3 = new ControllerSession({ cookies: { 'lionrock-session': ssid }, body: 'hello' });
    expect(Central.config.session.resave).toBe(true);
    const r3 = await c3.execute();
    expect(Central.config.session.resave).toBe(true);

    expect(r3.cookies.length).toBe(1);

    const record3 = c.state.get(ControllerMixinDatabase.DATABASES).get('session').prepare('SELECT * FROM sessions where sid = ?').get(sid);
    expect(record3.expired > lastUpdate).toBe(true);
  });

  test('invalid session sign', async () => {
    const db = new Database(`${__dirname}/test2/database/session.sqlite`);
    db.prepare('INSERT INTO sessions (sid, sess, expired) VALUES (?,?,?)').run('c8b76616-2f4e-4d3a-ab74-c2edd5ee19ad', '{"foo":"whatsup"}', 1597158162434);

    const c1 = new ControllerSession({ cookies: { 'lionrock-session': 'c8b76616-2f4e-4d3a-ab74-c2edd5ee19ad.WnKoj6+mumOJJ5N3Gc5hHiVVyUtKox8znpaNC69ckUk=' } });
    const r1 = await c1.execute('readfoo');
//        console.log(r1);
    expect(r1.body).toBe('whatsup');

    const c2 = new ControllerSession({ cookies: { 'lionrock-session': 'c8b76616-2f4e-4d3a-ab74-c2edd5ee19ad.WnKoj6+mumOJJ5N3Gc5hHiVVyUtKox8znpaNC000000=' } });
    const r2 = await c2.execute('readfoo');
//        console.log(r2);
    expect(r2.body).toBe(undefined);

    const c3 = new ControllerSession({ cookies: { 'lionrock-session': 'c8b76616-2f4e-4d3a-ab74-c2edd5ee19ad.WnKoj6+mumOJJ5N3Gc5hHiVVyUtKox8znpaNC69ckUk=' } });
    const r3 = await c3.execute('readfoo');
    //    console.log(r3);
    expect(r3.body).toBe('whatsup');
  });

  test('valid session signature, but session not in database', async () => {
    const data = Math.random();
    const c1 = new ControllerSession({ cookies: { 'lionrock-session': '5722ffcc-169a-4764-89f9-60045fe0d077.oZejsSIrAqd05PuxF/haV7aard2poAg8USR6+4TiYkQ=' }, body: data });
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
