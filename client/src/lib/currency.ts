/**
 * Format a number as Indian Rupee (INR) currency.
 * e.g., formatINR(1000) => "₹1,000.00"
 *       formatINR(100000) => "₹1,00,000.00"
 */
export const formatINR = (
  amount: number | string | null | undefined,
  decimals: number = 2
): string => {
  const num = Number(amount) || 0;
  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

/**
 * Format with sign (+ or -)
 * e.g. formatSignedINR(500, 'INCOME') => "+₹500.00"
 *      formatSignedINR(500, 'EXPENSE') => "-₹500.00"
 */
export const formatSignedINR = (
  amount: number | string | null | undefined,
  type?: 'INCOME' | 'EXPENSE' | string,
  decimals: number = 2
): string => {
  const num = Number(amount) || 0;
  const prefix = type ? (type === 'INCOME' ? '+' : '-') : (num < 0 ? '-' : '');
  const absNum = Math.abs(num);
  return `${prefix}₹${absNum.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};
