import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { supabase } from '../../lib/supabase';
import { router, useFocusEffect } from 'expo-router';
import { TOP_MARGIN } from '../../lib/constants';

export default function Home() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [profiles, setProfiles] = useState({});

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  async function fetchData() {
    const { data: cats } = await supabase.from('categories').select('*');
    if (cats) {
      const catMap = {};
      cats.forEach(c => catMap[c.id] = c);
      setCategories(catMap);
    }

    const { data: profs } = await supabase.from('profiles').select('*');
    if (profs) {
      const profMap = {};
      profs.forEach(p => profMap[p.id] = p);
      setProfiles(profMap);
    }

    const { data: exp } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false });

    if (exp) setExpenses(exp);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
  }, []);

  const totalPersonal = expenses.filter(e => !e.is_shared && e.owner_id === currentUser?.id).reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const totalShared = expenses.filter(e => e.is_shared).reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const totalMonth = totalPersonal + totalShared;
  const recentExpenses = expenses.slice(0, 5);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>💰 ExpenseTracker</Text>
        <Text style={styles.month}>
          {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
        </Text>
      </View>

      {/* Total Card */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total This Month</Text>
        <Text style={styles.totalAmount}>${totalMonth.toFixed(2)}</Text>
      </View>

      {/* Personal vs Shared */}
      <View style={styles.row}>
        <View style={[styles.smallCard, { backgroundColor: '#ede9fe' }]}>
          <Text style={styles.smallLabel}>👤 Personal</Text>
          <Text style={styles.smallAmount}>${totalPersonal.toFixed(2)}</Text>
        </View>
        <View style={[styles.smallCard, { backgroundColor: '#fce7f3' }]}>
          <Text style={styles.smallLabel}>👨‍👩‍👧 Shared</Text>
          <Text style={styles.smallAmount}>${totalShared.toFixed(2)}</Text>
        </View>
      </View>

      {/* Add Button */}
      <TouchableOpacity style={styles.addButton} onPress={() => router.push('/(tabs)/add')}>
        <Text style={styles.addButtonText}>➕ Add Expense</Text>
      </TouchableOpacity>

      {/* Recent Transactions */}
      <Text style={styles.sectionTitle}>Recent Transactions</Text>

      {recentExpenses.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No expenses yet</Text>
          <Text style={styles.emptySubtext}>Tap "Add Expense" to get started</Text>
        </View>
      ) : (
        recentExpenses.map((expense) => {
          const cat = categories[expense.category_id];
          return (
            <View key={expense.id} style={styles.expenseRow}>
              <View style={styles.expenseIcon}>
                <Text style={{ fontSize: 24 }}>{cat?.icon || '📦'}</Text>
              </View>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseDesc}>
                  {expense.description || cat?.name || 'Expense'}
                </Text>
                <Text style={styles.expenseMeta}>
                  {expense.expense_date} • {expense.is_shared ? '👨‍👩‍👧 Shared' : '👤 Personal'} • {profiles[expense.owner_id]?.full_name || 'You'}
                </Text>
              </View>
              <Text style={styles.expenseAmount}>
                ${parseFloat(expense.amount).toFixed(2)}
              </Text>
            </View>
          );
        })
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  header: { padding: 24, paddingTop: TOP_MARGIN },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1a1a2e' },
  month: { fontSize: 14, color: '#666', marginTop: 4 },
  totalCard: {
    backgroundColor: '#4f46e5', margin: 16, borderRadius: 20,
    padding: 24, alignItems: 'center'
  },
  totalLabel: { color: '#c7d2fe', fontSize: 14, marginBottom: 8 },
  totalAmount: { color: '#fff', fontSize: 42, fontWeight: 'bold' },
  row: { flexDirection: 'row', marginHorizontal: 16, gap: 12 },
  smallCard: { flex: 1, borderRadius: 16, padding: 16 },
  smallLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  smallAmount: { fontSize: 22, fontWeight: 'bold', color: '#1a1a2e' },
  addButton: {
    backgroundColor: '#4f46e5', margin: 16, borderRadius: 12,
    padding: 16, alignItems: 'center'
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', margin: 16, color: '#1a1a2e' },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#999' },
  expenseRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 12
  },
  expenseIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#f0f4ff', alignItems: 'center', justifyContent: 'center'
  },
  expenseInfo: { flex: 1, marginLeft: 12 },
  expenseDesc: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  expenseMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  expenseAmount: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e' }
});