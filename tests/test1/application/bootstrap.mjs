import Central from "@lionrockjs/central";
import {ControllerMixinSession} from '@lionrockjs/mixin-session';
import SessionAdapterJWT from "../../../classes/helper/session/JWT.mjs";

ControllerMixinSession.defaultAdapter = SessionAdapterJWT;

await Central.initConfig(new Map([
  ['cookie', await import('./config/cookie.mjs')],
  ['session', await import('./config/session.mjs')],
]));