export default {
  filename: import.meta.url,
  configs: ['session']
}

import SessionJWT from './classes/helper/session/JWT.mjs';

export {
  SessionJWT,
}