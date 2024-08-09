import { Model } from '@lionrockjs/central';

export default class Session extends Model {
  sid = null;

  expired = 0;

  sess = null;

  static joinTablePrefix = 'session';

  static tableName = 'sessions';

  static fields = new Map([
    ['sid', 'String!'],
    ['expired', 'Int!'],
    ['sess', 'String'],
  ]);
}