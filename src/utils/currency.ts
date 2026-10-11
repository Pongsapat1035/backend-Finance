const SATANG_PER_BAHT = 100;

export function bahtToSatang(amountInBaht: number): number {
  return Math.round((amountInBaht + Number.EPSILON) * SATANG_PER_BAHT);
}

export function satangToBaht(amountInSatang: number): number {
  return amountInSatang / SATANG_PER_BAHT;
}
