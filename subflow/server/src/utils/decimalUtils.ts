import Decimal from 'decimal.js';

// Configure decimal precision for monetary operations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function roundMoney(amount: number | string | Decimal): number {
  return new Decimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function addMoney(a: number | string, b: number | string): number {
  return new Decimal(a).plus(new Decimal(b)).toDecimalPlaces(2).toNumber();
}

export function subtractMoney(a: number | string, b: number | string): number {
  return new Decimal(a).minus(new Decimal(b)).toDecimalPlaces(2).toNumber();
}

export function multiplyMoney(a: number | string, b: number | string): number {
  return new Decimal(a).times(new Decimal(b)).toDecimalPlaces(2).toNumber();
}

export function calculatePercentage(base: number | string, percentage: number | string): number {
  return new Decimal(base)
    .times(new Decimal(percentage))
    .dividedBy(100)
    .toDecimalPlaces(2)
    .toNumber();
}
