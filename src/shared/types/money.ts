export type MoneyVnd = string;

export interface MoneySnapshot {
  amount: MoneyVnd;
  currency: 'VND';
  revision: string;
}
