import ConfigSession from './config/session.mjs';
import SessionJWT from './helper/session/JWT.mjs';
import {ControllerMixinSession} from "@lionrockjs/mixin-session";
ControllerMixinSession.defaultAdapter = SessionJWT;

export default {
  configs: {
    session: ConfigSession,
  }
}

export { 
  SessionJWT 
}