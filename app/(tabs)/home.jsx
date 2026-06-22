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
  const [currentUser, setCurrentUser] = useState(null);
  const [shoppingLists, setShoppingLists] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [travelTotal, setTravelTotal] = useState(0);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentYear = now.getFullYear();

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
  }, []);

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);

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

    // Fetch this year's travel total
    const { data: trips } = await supabase
      .from('trips')
      .select('id, start_date, travel_expenses(amount)')
      .gte('start_date', `${currentYear}-01-01`)
      .lte('start_date', `${currentYear}-12-31`);

    if (trips) {
      const total = trips.reduce((sum, trip) => {
        const tripSum = (trip.travel_expenses || []).reduce((s, e) => s + parseFloat(e.amount), 0);
        return sum + tripSum;
      }, 0);
      setTravelTotal(total);
    }

    // Fetch family members + shopping lists
    if (user) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

      if (prof?.family_id) {
        const { data: members } = await supabase
          .from('profiles')
          .select('*')
          .eq('family_id', prof.family_id);
        if (members) setFamilyMembers(members);
      } else {
        setFamilyMembers([]);
      }

      const { data: lists } = await supabase
        .from('shopping_lists')
        .select('*, shopping_items(id, is_checked)')
        .or(`owner_id.eq.${user.id}${prof?.family_id ? `,and(is_shared.eq.true,family_id.eq.${prof.family_id})` : ''}`)
        .order('created_at', { ascending: false });

      if (lists) setShoppingLists(lists);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  const monthExpenses = expenses.filter(e => e.expense_date?.startsWith(currentMonth));
  const totalMonth = monthExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const totalShared = monthExpenses.filter(e => e.is_shared).reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const personalTotalsByUser = {};
  monthExpenses.filter(e => !e.is_shared).forEach(e => {
    if (!personalTotalsByUser[e.owner_id]) personalTotalsByUser[e.owner_id] = 0;
    personalTotalsByUser[e.owner_id] += parseFloat(e.amount);
  });

  const myPersonalTotal = personalTotalsByUser[currentUser?.id] || 0;

  const otherMembersWithExpenses = familyMembers
    .filter(m => m.id !== currentUser?.id && personalTotalsByUser[m.id] > 0)
    .map(m => ({ ...m, total: personalTotalsByUser[m.id] }));

  const recentExpenses = expenses.slice(0, 5);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>💰 ExpenseTracker</Text>
        <Text style={styles.month}>
          {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </Text>
      </View>

      {/* Total Cards Row — Month + Year Travel */}
      <View style={styles.totalRow}>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>
            {familyMembers.length > 1 ? "Family This Month" : "This Month"}
          </Text>
          <Text style={styles.totalAmount}>${totalMonth.toFixed(2)}</Text>
        </View>
        <TouchableOpacity style={styles.travelTotalCard} onPress={() => router.push('/(tabs)/travel')}>
          <Text style={styles.travelTotalLabel}>✈️ {currentYear} Travel</Text>
          <Text style={styles.travelTotalAmount}>${travelTotal.toFixed(2)}</Text>
        </TouchableOpacity>
      </View>

      {/* Breakdown cards — dynamic per person */}
      <View style={styles.breakdownGrid}>
        <View style={[styles.smallCard, { backgroundColor: '#ede9fe' }]}>
          <Text style={styles.smallLabel}>👤 My Personal</Text>
          <Text style={styles.smallAmount}>${myPersonalTotal.toFixed(2)}</Text>
        </View>
        <View style={[styles.smallCard, { backgroundColor: '#fce7f3' }]}>
          <Text style={styles.smallLabel}>👨‍👩‍👧 Shared</Text>
          <Text style={styles.smallAmount}>${totalShared.toFixed(2)}</Text>
        </View>
        {otherMembersWithExpenses.map(member => (
          <View key={member.id} style={[styles.smallCard, { backgroundColor: '#e0f2fe' }]}>
            <Text style={styles.smallLabel}>👤 {member.full_name || 'Member'}'s Personal</Text>
            <Text style={styles.smallAmount}>${member.total.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {/* Action Buttons — 3 equal, centered */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(tabs)/add')}>
          <Text style={styles.actionIcon}>➕</Text>
          <Text style={styles.actionLabel}>Add Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButtonOutline} onPress={() => router.push('/(tabs)/shopping')}>
          <Text style={styles.actionIcon}>🛒</Text>
          <Text style={styles.actionLabelDark}>Shopping</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButtonOutline} onPress={() => router.push('/(tabs)/travel')}>
          <Text style={styles.actionIcon}>✈️</Text>
          <Text style={styles.actionLabelDark}>Travel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButtonOutline} onPress={() => router.push('/(tabs)/onetime')}>
          <Text style={styles.actionIcon}>📅</Text>
          <Text style={styles.actionLabelDark}>One-Time</Text>
        </TouchableOpacity>
      </View>

      {/* Shopping Lists Preview */}
      {shoppingLists.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Shopping Lists</Text>
          {shoppingLists.slice(0, 3).map(list => {
            const total = list.shopping_items?.length || 0;
            const checked = list.shopping_items?.filter(i => i.is_checked).length || 0;
            return (
              <TouchableOpacity
                key={list.id}
                style={styles.shoppingCard}
                onPress={() => router.push('/(tabs)/shopping')}
              >
                <Text style={styles.shoppingCardIcon}>
                  {list.is_shared ? '👨‍👩‍👧' : '👤'}
                </Text>
                <View style={styles.shoppingCardInfo}>
                  <Text style={styles.shoppingCardName}>{list.name}</Text>
                  <Text style={styles.shoppingCardMeta}>
                    {checked}/{total} items done
                  </Text>
                </View>
                {total > 0 && (
                  <View style={styles.shoppingProgress}>
                    <View style={styles.shoppingProgressTrack}>
                      <View style={[styles.shoppingProgressFill, {
                        width: `${total > 0 ? (checked / total) * 100 : 0}%`
                      }]} />
                    </View>
                  </View>
                )}
                <Text style={styles.shoppingArrow}>›</Text>
              </TouchableOpacity>
            );
          })}
        </>
      )}

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
  totalRow: { flexDirection: 'row', marginHorizontal: 16, gap: 12 },
  totalCard: {
    flex: 1.3, backgroundColor: '#4f46e5', borderRadius: 20,
    padding: 20, alignItems: 'center', justifyContent: 'center'
  },
  totalLabel: { color: '#c7d2fe', fontSize: 13, marginBottom: 6, textAlign: 'center' },
  totalAmount: { color: '#fff', fontSize: 30, fontWeight: 'bold' },
  travelTotalCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 20,
    padding: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e0e0e0'
  },
  travelTotalLabel: { color: '#666', fontSize: 12, marginBottom: 6, textAlign: 'center' },
  travelTotalAmount: { color: '#1a1a2e', fontSize: 22, fontWeight: 'bold' },
  breakdownGrid: {
    flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 16, gap: 12, marginTop: 12
  },
  smallCard: { flexGrow: 1, flexBasis: '45%', borderRadius: 16, padding: 16 },
  smallLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  smallAmount: { fontSize: 22, fontWeight: 'bold', color: '#1a1a2e' },
  actionRow: { flexDirection: 'row', marginHorizontal: 16, gap: 10, marginTop: 16 },
  actionButton: {
    flex: 1, backgroundColor: '#4f46e5', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center'
  },
  actionButtonOutline: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e0e0e0'
  },
  actionIcon: { fontSize: 20, marginBottom: 4 },
  actionLabel: { color: '#fff', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  actionLabelDark: { color: '#1a1a2e', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', margin: 16, color: '#1a1a2e' },
  shoppingCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 12, gap: 10
  },
  shoppingCardIcon: { fontSize: 22 },
  shoppingCardInfo: { flex: 1 },
  shoppingCardName: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  shoppingCardMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  shoppingProgress: { width: 60 },
  shoppingProgressTrack: { height: 6, backgroundColor: '#f0f4ff', borderRadius: 3 },
  shoppingProgressFill: { height: 6, backgroundColor: '#4f46e5', borderRadius: 3 },
  shoppingArrow: { fontSize: 20, color: '#ccc' },
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