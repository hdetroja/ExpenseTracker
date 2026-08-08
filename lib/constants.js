import { Platform, StatusBar } from 'react-native';

export const TOP_MARGIN = Platform.OS === 'android' 
  ? (StatusBar.currentHeight || 24) + 16 
  : 60;

export const CURRENCIES = {
  USD: { symbol: '$', name: 'US Dollar' },
  INR: { symbol: '₹', name: 'Indian Rupee' },
};

export function formatCurrency(amount, currency = 'USD') {
  const sym = CURRENCIES[currency]?.symbol || '$';
  return `${sym}${parseFloat(amount).toFixed(2)}`;
}