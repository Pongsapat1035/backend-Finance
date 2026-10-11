import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import buddhist from 'dayjs/plugin/buddhistEra';
import timezone from 'dayjs/plugin/timezone';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import duration from 'dayjs/plugin/duration';

export const PRODUCT_TIME_ZONE = 'Asia/Bangkok';

dayjs.extend(buddhist);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(duration);
dayjs.tz.setDefault(PRODUCT_TIME_ZONE);

export default dayjs;
