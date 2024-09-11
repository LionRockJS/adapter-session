import Central, {Model} from '@lionrockjs/central';
import ModDatabase, { ORMAdapterSQLite } from '@lionrockjs/adapter-database-better-sqlite3';
Central.addModules([ModDatabase]);

Model.defaultAdapter = ORMAdapterSQLite;

import {ControllerMixinSession} from '@lionrockjs/mixin-session';

import SessionAdapterDatabase from "../../../classes/helper/session/Database.mjs";
ControllerMixinSession.defaultAdapter = SessionAdapterDatabase;

await Central.initConfig(new Map([
  ['cookie', await import('./config/cookie.mjs')],
  ['session', await import('./config/session.mjs')],
]));