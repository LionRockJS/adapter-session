import url from "node:url";
const dirname = url.fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');
export default {dirname}

import SessionJWT from './classes/helper/session/JWT.mjs';

export {
  SessionJWT,
}