import { Model } from '@lionrockjs/central';

export default class Session extends Model {
  sid: string | null = null;

  expired: number = 0;

  sess: string | null = null;

  static joinTablePrefix = 'session';

  static tableName = 'sessions';

  static fields = new Map([
    ['sid', 'String!'],
    ['expired', 'Int!'],
    ['sess', 'String'],
  ]);
}
