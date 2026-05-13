export { default as SessionJWT } from './helper/session/JWT.mjs';
import { ControllerMixinSession } from "@lionrockjs/mixin-session";
import { SessionJWT } from "./index.js";
ControllerMixinSession.defaultAdapter = SessionJWT;
