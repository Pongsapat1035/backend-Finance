import dayjs from '../config/dayjs.config';

export function getPeriodForDate(date: Date): string {
  return dayjs(date).tz().format('YYYY-MM');
}

export function getPeriodRange(period: string) {
  const start = dayjs.tz(`${period}-01`).startOf('month');

  return {
    start: start.utc().toDate(),
    end: start.add(1, 'month').utc().toDate(),
  };
}

export function getMonthlyOccurrence(period: string, dayOfMonth: number): Date {
  const month = dayjs.tz(`${period}-01`);

  return month
    .date(Math.min(dayOfMonth, month.daysInMonth()))
    .startOf('day')
    .toDate();
}
