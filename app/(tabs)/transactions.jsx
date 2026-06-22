import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Modal, TextInput, Alert
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { TOP_MARGIN } from '../../lib/constants';

export default function Transactions() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState({});
  const [returns, setReturns] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedType, setSelectedType] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [returnModal, setReturnModal] = useState(false);
  const [returnExpense, setReturnExpense] = useState(null);
  const [returnAmount, setReturnAmount] = useState('');
  const [expandedExpense, setExpandedExpense] = useState(null);
  const [editModal, setEditModal] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCategory, setEditCategory] = useState(null);
  const [editIsShared, setEditIsShared] = useState(false);
  const [profiles, setProfiles] = useState({});

  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [currentMonth, currentYear])
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

    const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    const { data: exp } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false });

    if (exp) {
      const filtered = exp.filter(e => e.expense_date?.startsWith(monthStr));
      setExpenses(filtered);
    }

    // Fetch all returns
    const { data: rets } = await supabase
      .from('returns')
      .select('*')
      .order('return_date', { ascending: false });

    if (rets) {
      const retMap = {};
      rets.forEach(r => {
        if (!retMap[r.expense_id]) retMap[r.expense_id] = [];
        retMap[r.expense_id].push(r);
      });
      setReturns(retMap);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  function goToPrevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  }

  function goToNextMonth() {
    const isCurrentMonth = currentMonth === now.getMonth() && currentYear === now.getFullYear();
    if (isCurrentMonth) return;
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  }

  async function deleteExpense(id) {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('expenses').delete().eq('id', id);
          if (!error) fetchData();
        }
      }
    ]);
  }

  async function deleteReturn(id) {
    Alert.alert(
      'Delete Return',
      'Are you sure you want to delete this return?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('returns').delete().eq('id', id);
            if (!error) fetchData();
            else Alert.alert('Error', error.message);
          }
        }
      ]
    );
  }

  function handleReturn(expense) {
    const cat = categories[expense.category_id];
    const totalReturned = (returns[expense.id] || []).reduce((sum, r) => sum + parseFloat(r.return_amount), 0);
    const remaining = parseFloat(expense.amount) - totalReturned;

    if (remaining <= 0) {
      Alert.alert('Info', 'This expense has been fully returned already.');
      return;
    }

    Alert.alert(
      'Return Item',
      `"${expense.description || cat?.name}"\nOriginal: $${parseFloat(expense.amount).toFixed(2)}\nAlready returned: $${totalReturned.toFixed(2)}\nRemaining: $${remaining.toFixed(2)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Partial Return',
          onPress: () => {
            setReturnExpense({ ...expense, remaining });
            setReturnAmount('');
            setReturnModal(true);
          }
        },
        {
          text: 'Full Return',
          style: 'destructive',
          onPress: () => confirmFullReturn(expense, remaining)
        }
      ]
    );
  }

  async function confirmPartialReturn() {
    const amount = parseFloat(returnAmount);
    if (isNaN(amount) || amount <= 0 || amount > returnExpense.remaining) {
      Alert.alert('Error', `Invalid amount. Max remaining is $${returnExpense.remaining.toFixed(2)}`);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('returns').insert({
      expense_id: returnExpense.id,
      return_amount: amount,
      return_date: new Date().toISOString().split('T')[0],
      returned_by: user?.id,
    });
    
    if (!error) {
      setReturnModal(false);
      Alert.alert('Success', `$${amount.toFixed(2)} return recorded!`);
      fetchData();
    }
  }

  async function confirmFullReturn(expense, remaining) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('returns').insert({
      expense_id: expense.id,
      return_amount: remaining,
      return_date: new Date().toISOString().split('T')[0],
      returned_by: user?.id,
    });

    if (!error) {
      Alert.alert('Success', `Full return of $${remaining.toFixed(2)} recorded!`);
      fetchData();
    }
  }

  function handleEdit(expense) {
    setEditExpense(expense);
    setEditAmount(String(expense.amount));
    setEditDescription(expense.description || '');
    setEditDate(expense.expense_date);
    setEditCategory(expense.category_id);
    setEditIsShared(expense.is_shared);
    setEditModal(true);
  }

  async function saveEdit() {
    if (!editAmount || isNaN(parseFloat(editAmount))) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const { data, error } = await supabase
      .from('expenses')
      .update({
        amount: parseFloat(editAmount),
        description: editDescription,
        expense_date: editDate,
        category_id: editCategory,
        is_shared: editIsShared,
      })
      .eq('id', editExpense.id)
      .select();

    if (error) {
      Alert.alert('Error', error.message);
    } else if (!data || data.length === 0) {
      Alert.alert('Cannot Edit', 'RLS blocked — check family_id on expense');
    } else {
      setEditModal(false);
      Alert.alert('Success', 'Expense updated!');
      fetchData();
    }
  }

  const filteredExpenses = expenses.filter(e => {
    const typeMatch = selectedType === 'all' ||
      (selectedType === 'personal' && !e.is_shared) ||
      (selectedType === 'shared' && e.is_shared);
    const catMatch = !selectedCategory || e.category_id === selectedCategory;
    return typeMatch && catMatch;
  });

  const getNetAmount = (expense) => {
    const totalReturned = (returns[expense.id] || []).reduce((sum, r) => sum + parseFloat(r.return_amount), 0);
    return parseFloat(expense.amount) - totalReturned;
  };

  const total = filteredExpenses.reduce((sum, e) => sum + getNetAmount(e), 0);
  const uniqueCategories = [...new Set(expenses.map(e => e.category_id))]
    .map(id => categories[id])
    .filter(Boolean);

  const isCurrentMonth = currentMonth === now.getMonth() && currentYear === now.getFullYear();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Transactions</Text>

      {/* Month Navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity style={styles.monthArrow} onPress={goToPrevMonth}>
          <Text style={styles.monthArrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {monthNames[currentMonth]} {currentYear}
        </Text>
        <TouchableOpacity
          style={[styles.monthArrow, isCurrentMonth && styles.monthArrowDisabled]}
          onPress={goToNextMonth}
          disabled={isCurrentMonth}
        >
          <Text style={[styles.monthArrowText, isCurrentMonth && { color: '#ccc' }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Type Filter */}
      <View style={styles.filterRow}>
        {['all', 'personal', 'shared'].map(type => (
          <TouchableOpacity
            key={type}
            style={[styles.filterBtn, selectedType === type && styles.filterBtnActive]}
            onPress={() => setSelectedType(type)}
          >
            <Text style={[styles.filterText, selectedType === type && styles.filterTextActive]}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
        <TouchableOpacity
          style={[styles.catChip, !selectedCategory && styles.catChipActive]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[styles.catChipText, !selectedCategory && styles.catChipTextActive]}>All</Text>
        </TouchableOpacity>
        {uniqueCategories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.catChip, selectedCategory === cat.id && styles.catChipActive]}
            onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
          >
            <Text style={styles.catChipText}>{cat.icon} {cat.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>
          {filteredExpenses.length} transaction{filteredExpenses.length !== 1 ? 's' : ''}
        </Text>
        <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
      </View>

      {/* Expense List */}
      {filteredExpenses.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No transactions for this month</Text>
          <Text style={styles.emptySubtext}>Tap ‹ to go to a previous month</Text>
        </View>
      ) : (
        filteredExpenses.map((expense) => {
          const cat = categories[expense.category_id];
          const expReturns = returns[expense.id] || [];
          const totalReturned = expReturns.reduce((sum, r) => sum + parseFloat(r.return_amount), 0);
          const netAmount = parseFloat(expense.amount) - totalReturned;
          const isExpanded = expandedExpense === expense.id;
          const hasReturns = expReturns.length > 0;

          return (
            <View key={expense.id} style={styles.expenseCard}>
              <View style={styles.expenseRow}>
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
                  <Text style={[styles.catTag, { backgroundColor: (cat?.color || '#B0B0B0') + '33' }]}>
                    {cat?.icon} {cat?.name}
                  </Text>
                  {hasReturns && (
                    <TouchableOpacity onPress={() => setExpandedExpense(isExpanded ? null : expense.id)}>
                      <Text style={styles.returnSummary}>
                        ↩️ ${totalReturned.toFixed(2)} returned • {isExpanded ? 'hide' : 'show details'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.expenseRight}>
                  <Text style={[styles.expenseAmount, totalReturned > 0 && styles.amountReduced]}>
                    ${netAmount.toFixed(2)}
                  </Text>
                  {totalReturned > 0 && (
                    <Text style={styles.originalAmount}>${parseFloat(expense.amount).toFixed(2)}</Text>
                  )}
                  <View style={styles.actionIcons}>
                    <TouchableOpacity onPress={() => handleEdit(expense)}>
                      <Text style={styles.editBtn}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleReturn(expense)}>
                      <Text style={styles.returnBtn}>↩️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteExpense(expense.id)}>
                      <Text style={styles.deleteBtn}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {isExpanded && expReturns.length > 0 && (
                <View style={styles.returnHistory}>
                  <Text style={styles.returnHistoryTitle}>Return History</Text>
                  {expReturns.map((r, index) => (
                    <View key={r.id} style={styles.returnHistoryRow}>
                      <Text style={styles.returnHistoryIndex}>#{index + 1}</Text>
                      <Text style={styles.returnHistoryDate}>📅 {r.return_date} • {profiles[r.returned_by]?.full_name || 'Unknown'}</Text>
                      <Text style={styles.returnHistoryAmount}>-${parseFloat(r.return_amount).toFixed(2)}</Text>
                      <TouchableOpacity onPress={() => deleteReturn(r.id)}>
                        <Text style={{ fontSize: 14 }}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })
      )}

      {/* Edit Modal */}
      <Modal
        visible={editModal}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Expense</Text>

              <Text style={styles.modalLabel}>Amount ($)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={editAmount}
                onChangeText={setEditAmount}
              />

              <Text style={styles.modalLabel}>Description</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Description"
                value={editDescription}
                onChangeText={setEditDescription}
              />

              <Text style={styles.modalLabel}>Date</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="YYYY-MM-DD"
                value={editDate}
                onChangeText={setEditDate}
              />

              <Text style={styles.modalLabel}>Type</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, !editIsShared && styles.toggleActive]}
                  onPress={() => setEditIsShared(false)}
                >
                  <Text style={[styles.toggleText, !editIsShared && styles.toggleTextActive]}>
                    👤 Personal
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, editIsShared && styles.toggleActive]}
                  onPress={() => setEditIsShared(true)}
                >
                  <Text style={[styles.toggleText, editIsShared && styles.toggleTextActive]}>
                    👨‍👩‍👧 Shared
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Category</Text>
              <View style={styles.catGrid}>
                {Object.values(categories).map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catOption, editCategory === cat.id && { backgroundColor: cat.color }]}
                    onPress={() => setEditCategory(cat.id)}
                  >
                    <Text style={{ fontSize: 16 }}>{cat.icon}</Text>
                    <Text style={styles.catOptionText}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={saveEdit}>
                  <Text style={styles.confirmBtnText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Return Modal */}
      <Modal
        visible={returnModal}
        transparent
        animationType="slide"
        onRequestClose={() => setReturnModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Partial Return</Text>
            <Text style={styles.modalSub}>
              Remaining amount: ${returnExpense?.remaining.toFixed(2)}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter return amount"
              keyboardType="decimal-pad"
              value={returnAmount}
              onChangeText={setReturnAmount}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setReturnModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmPartialReturn}>
                <Text style={styles.confirmBtnText}>Apply Return</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a1a2e', marginTop: TOP_MARGIN, marginHorizontal: 16, marginBottom: 8 },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff',
    borderRadius: 16, padding: 12
  },
  monthArrow: { padding: 8 },
  monthArrowDisabled: { opacity: 0.3 },
  monthArrowText: { fontSize: 28, color: '#4f46e5', fontWeight: 'bold' },
  monthLabel: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e' },
  filterRow: { flexDirection: 'row', marginHorizontal: 16, gap: 8, marginBottom: 12 },
  filterBtn: {
    flex: 1, padding: 8, borderRadius: 10, borderWidth: 1,
    borderColor: '#e0e0e0', backgroundColor: '#fff', alignItems: 'center'
  },
  filterBtnActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  filterText: { fontSize: 13, color: '#666', fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  catScroll: { paddingLeft: 16, marginBottom: 12 },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', marginRight: 8
  },
  catChipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  catChipText: { fontSize: 13, color: '#444' },
  catChipTextActive: { color: '#fff' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff',
    padding: 12, borderRadius: 12
  },
  totalLabel: { fontSize: 14, color: '#666' },
  totalAmount: { fontSize: 18, fontWeight: 'bold', color: '#4f46e5' },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#999' },
  expenseCard: {
    backgroundColor: '#fff', marginHorizontal: 16,
    marginBottom: 8, borderRadius: 12, overflow: 'hidden'
  },
  expenseRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  expenseIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#f0f4ff', alignItems: 'center', justifyContent: 'center'
  },
  expenseInfo: { flex: 1, marginLeft: 12 },
  expenseDesc: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  expenseMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  catTag: { fontSize: 11, color: '#444', marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  returnSummary: { fontSize: 11, color: '#4f46e5', marginTop: 4, fontWeight: '600' },
  expenseRight: { alignItems: 'flex-end', gap: 4 },
  expenseAmount: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e' },
  amountReduced: { color: '#4f46e5' },
  originalAmount: { fontSize: 11, color: '#999', textDecorationLine: 'line-through' },
  actionIcons: { flexDirection: 'row', gap: 8 },
  editBtn: { fontSize: 18 },
  returnBtn: { fontSize: 18 },
  deleteBtn: { fontSize: 18 },
  returnHistory: { backgroundColor: '#f8f0ff', padding: 12, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  returnHistoryTitle: { fontSize: 12, fontWeight: 'bold', color: '#4f46e5', marginBottom: 8 },
  returnHistoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  returnHistoryIndex: { fontSize: 11, color: '#999', width: 20 },
  returnHistoryDate: { fontSize: 12, color: '#666', flex: 1 },
  returnHistoryAmount: { fontSize: 13, fontWeight: 'bold', color: '#e53e3e' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  modalSub: { fontSize: 14, color: '#666', marginBottom: 16 },
  modalInput: { backgroundColor: '#f0f4ff', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  confirmBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#4f46e5', alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '600' },
  modalLabel: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8, marginTop: 4 },
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  toggleBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#fff', alignItems: 'center' },
  toggleActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#666' },
  toggleTextActive: { color: '#fff' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  catOption: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#f0f4ff', flexDirection: 'row', alignItems: 'center', gap: 4 },
  catOptionText: { fontSize: 12, color: '#444' },
});