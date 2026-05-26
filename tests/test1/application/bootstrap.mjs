import { Central } from "@lionrockjs/central";
import {ControllerMixinSession} from '@lionrockjs/mixin-session';
import SessionAdapterJWT from "../../../dist/helper/session/JWT.mjs";

ControllerMixinSession.defaultAdapter = SessionAdapterJWT;

await Central.addConfig(new Map([
  ['cookie', await import('./config/cookie.mjs')],
  ['session', await import('./config/session.mjs')],
]));
