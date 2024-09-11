import url from "node:url";
const dirname = url.fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');
export default {dirname}

import SessionAdapterDatabase from './classes/helper/session/Database.mjs';

export {
  SessionAdapterDatabase,
}