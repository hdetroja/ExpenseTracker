import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

const CurrencyContext = createContext({ currency: 'USD', symbol: '$' });

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState('USD');
  const symbol = currency === 'INR' ? '₹' : '$';

  useEffect(() => {
    fetchCurrency();
    const { data: listener } = supabase.auth.onAuthStateChange(() => fetchCurrency());
    return () => listener?.subscription?.unsubscribe();
  }, []);

  async function fetchCurrency() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase.from('profiles').select('family_id, currency').eq('id', user.id).single();
    if (!prof) return;
    if (prof.family_id) {
      const { data: fam } = await supabase.from('families').select('currency').eq('id', prof.family_id).single();
      if (fam?.currency) { setCurrency(fam.currency); return; }
    }
    // No family — use personal currency
    if (prof.currency) setCurrency(prof.currency);
  }

  return (
    <CurrencyContext.Provider value={{ currency, symbol, setCurrency, fetchCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}