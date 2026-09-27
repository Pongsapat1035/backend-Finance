import { Transform, TransformFnParams } from 'class-transformer';
import { bahtToSatang } from '../utils/currency';

export const MAX_MINOR_AMOUNT = 2_147_483_647;

export function BahtToSatang(): PropertyDecorator {
  return Transform(
    ({ value }: TransformFnParams): unknown => {
      if (value === null || value === undefined) return value;

      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > MAX_MINOR_AMOUNT / 100 ||
        Number(value.toFixed(2)) !== value
      ) {
        return NaN;
      }

      return bahtToSatang(value);
    },
    { toClassOnly: true },
  );
}
