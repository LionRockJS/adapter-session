export default {
  filename: import.meta.url,
  configs: ['session']
}

import SessionAdapterDatabase from './classes/helper/session/Database.mjs';

export {
  SessionAdapterDatabase,
}