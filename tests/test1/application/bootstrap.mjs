import {HelperSession} from '@lionrockjs/mixin-session';
import HelperSessionJWT from "../../../classes/helper/session/JWT.mjs";

HelperSession.defaultAdapter = HelperSessionJWT;