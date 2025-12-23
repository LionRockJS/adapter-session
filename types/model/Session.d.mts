import { Model } from '@lionrockjs/central';
export default class Session extends Model {
    sid: string | null;
    expired: number;
    sess: string | null;
    static joinTablePrefix: string;
    static tableName: string;
    static fields: Map<string, string>;
}
