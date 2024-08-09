import Central, {Model} from '@lionrockjs/central';
import ModDatabase, { ORMAdapterSQLite } from '@lionrockjs/adapter-database-better-sqlite3';
Central.addModules([ModDatabase]);

Model.defaultAdapter = ORMAdapterSQLite;

import {HelperSession} from '@lionrockjs/mixin-session';
import HelperSessionDatabase from "../../../classes/helper/session/Database.mjs";

HelperSession.defaultAdapter = HelperSessionDatabase;