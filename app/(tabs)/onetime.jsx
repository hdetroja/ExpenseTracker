import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, RefreshControl, Modal, Platform
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect, router } from 'expo-router';
import { TOP_MARGIN } from '../../lib/constants';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function OneTime() {
  const [expenses, setExpenses] = useState([]);
  const [returns, setReturns] = useState({});
  const [categories, setCategories] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [expandedExpense, setExpandedExpense] = useState(null);

  // Add form state
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isShared, setIsShared] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editModal, setEditModal] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState(null);
  const [editIsShared, setEditIsShared] = useState(false);
  const [editDate, setEditDate] = useState(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  // Return state
  const [returnModal, setReturnModal] = useState(false);
  const [returnExpense, setReturnExpense] = useState(null);
  const [returnAmount, setReturnAmount] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [selectedYear])
  );

  async function fetchData() {
    const { data: cats } = await supabase.from('categories').select('*').order('name');
    if (cats) setCategories(cats);

    const { data: profs } = await supabase.from('profiles').select('*');
    if (profs) {
      const profMap = {};
      profs.forEach(p => profMap[p.id] = p);
      setProfiles(profMap);
    }

    const { data: exp } = await supabase
      .from('onetime_expenses')
      .select('*')
      .eq('year', selectedYear)
      .order('expense_date', { ascending: false });
    if (exp) setExpenses(exp);

    const { data: rets } = await supabase
      .from('onetime_returns')
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

  function resetForm() {
    setAmount('');
    setDescription('');
    setSelectedCategory(null);
    setIsShared(false);
    setDate(new Date());
  }

  function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async function handleSave() {
    if (!amount || isNaN(parseFloat(amount))) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('profiles').select('family_id').eq('id', user.id).single();

    const { error } = await supabase.from('onetime_expenses').insert({
      amount: parseFloat(amount),
      description: description.trim(),
      category_id: selectedCategory,
      is_shared: isShared,
      expense_date: formatDate(date),
      year: selectedYear,
      owner_id: user.id,
      family_id: prof?.family_id || null,
    });

    if (error) Alert.alert('Error', error.message);
    else { setModalVisible(false); resetForm(); fetchData(); }
    setLoading(false);
  }

  function handleEdit(item) {
    setEditExpense(item);
    setEditAmount(String(item.amount));
    setEditDescription(item.description || '');
    setEditCategory(item.category_id);
    setEditIsShared(item.is_shared);
    setEditDate(new Date(item.expense_date + 'T12:00:00'));
    setEditModal(true);
  }

  async function saveEdit() {
    if (!editAmount || isNaN(parseFloat(editAmount))) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    const { data, error } = await supabase
      .from('onetime_expenses')
      .update({
        amount: parseFloat(editAmount),
        description: editDescription,
        expense_date: formatDate(editDate),
        category_id: editCategory,
        is_shared: editIsShared,
      })
      .eq('id', editExpense.id)
      .select();

    if (error) Alert.alert('Error', error.message);
    else if (!data || data.length === 0) Alert.alert('Cannot Edit', 'Permission denied.');
    else { setEditModal(false); Alert.alert('Success', 'Updated!'); fetchData(); }
  }

  async function deleteExpense(id) {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('onetime_expenses').delete().eq('id', id);
          if (!error) fetchData();
          else Alert.alert('Error', error.message);
        }
      }
    ]);
  }

  function handleReturn(item) {
    const totalReturned = (returns[item.id] || []).reduce((sum, r) => sum + parseFloat(r.return_amount), 0);
    const remaining = parseFloat(item.amount) - totalReturned;
    if (remaining <= 0) { Alert.alert('Info', 'Already fully returned.'); return; }

    Alert.alert(
      'Return',
      `"${item.description}"\nRemaining: $${remaining.toFixed(2)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Partial Return',
          onPress: () => { setReturnExpense({ ...item, remaining }); setReturnAmount(''); setReturnModal(true); }
        },
        {
          text: 'Full Return', style: 'destructive',
          onPress: () => confirmReturn(item.id, remaining)
        }
      ]
    );
  }

  async function confirmReturn(expenseId, amount) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('onetime_returns').insert({
      expense_id: expenseId,
      return_amount: amount,
      return_date: formatDate(new Date()),
      returned_by: user?.id,
    });
    if (!error) { Alert.alert('Success', `$${amount.toFixed(2)} return recorded!`); fetchData(); }
    else Alert.alert('Error', error.message);
  }

  async function confirmPartialReturn() {
    const amt = parseFloat(returnAmount);
    if (isNaN(amt) || amt <= 0 || amt > returnExpense.remaining) {
      Alert.alert('Error', `Max is $${returnExpense.remaining.toFixed(2)}`);
      return;
    }
    await confirmReturn(returnExpense.id, amt);
    setReturnModal(false);
  }

  async function deleteReturn(id) {
    Alert.alert('Delete Return', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes', style: 'destructive',
        onPress: async () => {
          await supabase.from('onetime_returns').delete().eq('id', id);
          fetchData();
        }
      }
    ]);
  }

  const catMap = {};
  categories.forEach(c => catMap[c.id] = c);

  const total = expenses.reduce((sum, e) => {
    const ret = (returns[e.id] || []).reduce((s, r) => s + parseFloat(r.return_amount), 0);
    return sum + parseFloat(e.amount) - ret;
  }, 0);

  const years = [];
  for (let y = new Date().getFullYear(); y >= new Date().getFullYear() - 5; y--) years.push(y);

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/home')}>
          <Text style={styles.backBtn}>‹ Home</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>One-Time Costs 📅</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yearScroll}>
        {years.map(y => (
          <TouchableOpacity key={y} style={[styles.yearChip, selectedYear === y && styles.yearChipActive]} onPress={() => setSelectedYear(y)}>
            <Text style={[styles.yearChipText, selectedYear === y && styles.yearChipTextActive]}>{y}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>{selectedYear} One-Time Total</Text>
        <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
        <Text style={styles.totalSub}>{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</Text>
      </View>

      <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
        <Text style={styles.addBtnText}>➕ Add One-Time Expense</Text>
      </TouchableOpacity>

      {expenses.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No one-time expenses for {selectedYear}</Text>
          <Text style={styles.emptySubtext}>Add insurance, taxes, gifts, etc.</Text>
        </View>
      ) : (
        expenses.map(item => {
          const cat = catMap[item.category_id];
          const expReturns = returns[item.id] || [];
          const totalReturned = expReturns.reduce((sum, r) => sum + parseFloat(r.return_amount), 0);
          const netAmount = parseFloat(item.amount) - totalReturned;
          const isExpanded = expandedExpense === item.id;

          return (
            <View key={item.id} style={styles.expenseCard}>
              <View style={styles.expenseRow}>
                <View style={styles.expenseIcon}>
                  <Text style={{ fontSize: 22 }}>{cat?.icon || '📦'}</Text>
                </View>
                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseDesc}>{item.description}</Text>
                  <Text style={styles.expenseMeta}>
                    {item.expense_date} • {item.is_shared ? '👨‍👩‍👧 Shared' : '👤 Personal'}
                  </Text>
                  {cat && <Text style={[styles.catTag, { backgroundColor: (cat.color || '#ccc') + '33' }]}>{cat.icon} {cat.name}</Text>}
                  <Text style={styles.addedBy}>Added by {profiles[item.owner_id]?.full_name || 'You'}</Text>
                  {expReturns.length > 0 && (
                    <TouchableOpacity onPress={() => setExpandedExpense(isExpanded ? null : item.id)}>
                      <Text style={styles.returnSummary}>↩️ ${totalReturned.toFixed(2)} returned • {isExpanded ? 'hide' : 'show'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.expenseRight}>
                  <Text style={[styles.expenseAmount, totalReturned > 0 && { color: '#4f46e5' }]}>${netAmount.toFixed(2)}</Text>
                  {totalReturned > 0 && <Text style={styles.originalAmount}>${parseFloat(item.amount).toFixed(2)}</Text>}
                  <View style={styles.actionIcons}>
                    <TouchableOpacity onPress={() => handleEdit(item)}><Text style={styles.actionBtn}>✏️</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleReturn(item)}><Text style={styles.actionBtn}>↩️</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteExpense(item.id)}><Text style={styles.actionBtn}>🗑️</Text></TouchableOpacity>
                  </View>
                </View>
              </View>

              {isExpanded && expReturns.length > 0 && (
                <View style={styles.returnHistory}>
                  <Text style={styles.returnHistoryTitle}>Return History</Text>
                  {expReturns.map((r, idx) => (
                    <View key={r.id} style={styles.returnHistoryRow}>
                      <Text style={styles.returnHistoryIdx}>#{idx + 1}</Text>
                      <Text style={styles.returnHistoryDate}>📅 {r.return_date} • {profiles[r.returned_by]?.full_name || 'Unknown'}</Text>
                      <Text style={styles.returnHistoryAmt}>-${parseFloat(r.return_amount).toFixed(2)}</Text>
                      <TouchableOpacity onPress={() => deleteReturn(r.id)}><Text style={{ fontSize: 14 }}>🗑️</Text></TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })
      )}

      {/* Add Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add One-Time Expense</Text>
              <Text style={styles.label}>Description</Text>
              <TextInput style={styles.input} placeholder="e.g. Car Insurance, Tax Filing" value={description} onChangeText={setDescription} autoFocus />
              <Text style={styles.label}>Amount ($)</Text>
              <TextInput style={styles.input} placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateBtnText}>📅 {date.toDateString()}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker key={`date-${showDatePicker}`} value={date} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(e, selected) => { setShowDatePicker(Platform.OS === 'ios'); if (selected) setDate(selected); }} />
              )}
              <Text style={styles.label}>Type</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity style={[styles.toggleBtn, !isShared && styles.toggleActive]} onPress={() => setIsShared(false)}>
                  <Text style={[styles.toggleText, !isShared && styles.toggleTextActive]}>👤 Personal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleBtn, isShared && styles.toggleActive]} onPress={() => setIsShared(true)}>
                  <Text style={[styles.toggleText, isShared && styles.toggleTextActive]}>👨‍👩‍👧 Shared</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.label}>Category</Text>
              <View style={styles.catGrid}>
                {categories.map(cat => (
                  <TouchableOpacity key={cat.id} style={[styles.catBtn, selectedCategory === cat.id && { backgroundColor: cat.color }]} onPress={() => setSelectedCategory(cat.id)}>
                    <Text style={{ fontSize: 16 }}>{cat.icon}</Text>
                    <Text style={styles.catBtnText}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setModalVisible(false); resetForm(); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
                  <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Expense</Text>
              <Text style={styles.label}>Description</Text>
              <TextInput style={styles.input} value={editDescription} onChangeText={setEditDescription} />
              <Text style={styles.label}>Amount ($)</Text>
              <TextInput style={styles.input} value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" />
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEditDatePicker(true)}>
                <Text style={styles.dateBtnText}>📅 {editDate.toDateString()}</Text>
              </TouchableOpacity>
              {showEditDatePicker && (
                <DateTimePicker key={`editdate-${showEditDatePicker}`} value={editDate} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(e, selected) => { setShowEditDatePicker(Platform.OS === 'ios'); if (selected) setEditDate(selected); }} />
              )}
              <Text style={styles.label}>Type</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity style={[styles.toggleBtn, !editIsShared && styles.toggleActive]} onPress={() => setEditIsShared(false)}>
                  <Text style={[styles.toggleText, !editIsShared && styles.toggleTextActive]}>👤 Personal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleBtn, editIsShared && styles.toggleActive]} onPress={() => setEditIsShared(true)}>
                  <Text style={[styles.toggleText, editIsShared && styles.toggleTextActive]}>👨‍👩‍👧 Shared</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.label}>Category</Text>
              <View style={styles.catGrid}>
                {categories.map(cat => (
                  <TouchableOpacity key={cat.id} style={[styles.catBtn, editCategory === cat.id && { backgroundColor: cat.color }]} onPress={() => setEditCategory(cat.id)}>
                    <Text style={{ fontSize: 16 }}>{cat.icon}</Text>
                    <Text style={styles.catBtnText}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Return Modal */}
      <Modal visible={returnModal} transparent animationType="slide" onRequestClose={() => setReturnModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Partial Return</Text>
            <Text style={styles.modalSub}>Remaining: ${returnExpense?.remaining.toFixed(2)}</Text>
            <TextInput style={styles.input} placeholder="Enter return amount" keyboardType="decimal-pad" value={returnAmount} onChangeText={setReturnAmount} autoFocus />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setReturnModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={confirmPartialReturn}>
                <Text style={styles.saveBtnText}>Apply Return</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', marginTop: TOP_MARGIN, marginHorizontal: 16 },
  backBtn: { fontSize: 16, color: '#4f46e5', fontWeight: '600' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a1a2e', marginHorizontal: 16, marginTop: 8, marginBottom: 16 },
  yearScroll: { paddingLeft: 16, marginBottom: 16 },
  yearChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', marginRight: 8 },
  yearChipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  yearChipText: { fontSize: 14, color: '#444', fontWeight: '600' },
  yearChipTextActive: { color: '#fff' },
  totalCard: { backgroundColor: '#4f46e5', marginHorizontal: 16, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16 },
  totalLabel: { color: '#c7d2fe', fontSize: 14, marginBottom: 8 },
  totalAmount: { color: '#fff', fontSize: 42, fontWeight: 'bold' },
  totalSub: { color: '#c7d2fe', fontSize: 12, marginTop: 4 },
  addBtn: { backgroundColor: '#4f46e5', marginHorizontal: 16, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#999' },
  expenseCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, overflow: 'hidden' },
  expenseRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  expenseIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0f4ff', alignItems: 'center', justifyContent: 'center' },
  expenseInfo: { flex: 1, marginLeft: 12 },
  expenseDesc: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  expenseMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  catTag: { fontSize: 11, color: '#444', marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  addedBy: { fontSize: 11, color: '#999', marginTop: 2 },
  returnSummary: { fontSize: 11, color: '#4f46e5', marginTop: 4, fontWeight: '600' },
  expenseRight: { alignItems: 'flex-end', gap: 4 },
  expenseAmount: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e' },
  originalAmount: { fontSize: 11, color: '#999', textDecorationLine: 'line-through' },
  actionIcons: { flexDirection: 'row', gap: 6 },
  actionBtn: { fontSize: 16 },
  returnHistory: { backgroundColor: '#f8f0ff', padding: 12, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  returnHistoryTitle: { fontSize: 12, fontWeight: 'bold', color: '#4f46e5', marginBottom: 8 },
  returnHistoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  returnHistoryIdx: { fontSize: 11, color: '#999', width: 20 },
  returnHistoryDate: { fontSize: 12, color: '#666', flex: 1 },
  returnHistoryAmt: { fontSize: 13, fontWeight: 'bold', color: '#e53e3e' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 16 },
  modalSub: { fontSize: 14, color: '#666', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: '#f0f4ff', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 12 },
  dateBtn: { backgroundColor: '#f0f4ff', borderRadius: 12, padding: 16, marginBottom: 12 },
  dateBtnText: { fontSize: 15, color: '#1a1a2e' },
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  toggleBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#fff', alignItems: 'center' },
  toggleActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#666' },
  toggleTextActive: { color: '#fff' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  catBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#f0f4ff', flexDirection: 'row', alignItems: 'center', gap: 4 },
  catBtnText: { fontSize: 12, color: '#444' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  saveBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#4f46e5', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600' }
});