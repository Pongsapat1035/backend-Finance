import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

export const PRODUCT_TIME_ZONE = 'Asia/Bangkok';

export function getPeriodForDate(date: Date): string {
  return dayjs(date).tz(PRODUCT_TIME_ZONE).format('YYYY-MM');
}

export function getPeriodRange(period: string) {
  const start = dayjs.tz(`${period}-01`, PRODUCT_TIME_ZONE).startOf('month');

  return {
    start: start.utc().toDate(),
    end: start.add(1, 'month').utc().toDate(),
  };
}

export function getMonthlyOccurrence(period: string, dayOfMonth: number): Date {
  const month = dayjs.tz(`${period}-01`, PRODUCT_TIME_ZONE);

  return month
    .date(Math.min(dayOfMonth, month.daysInMonth()))
    .startOf('day')
    .toDate();
}
