import {Central} from '@lionrockjs/central';

await Central.initConfig(new Map([[
  'session', await import('./config/session.mjs')
]]))