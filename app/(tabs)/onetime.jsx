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
  const [categories, setCategories] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Form state
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isShared, setIsShared] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

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
    const { data: prof } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single();

    const { error } = await supabase.from('onetime_expenses').insert({
      amount: parseFloat(amount),
      description: description.trim(),
      category_id: selectedCategory,
      is_shared: isShared,
      expense_date: date.toISOString().split('T')[0],
      year: selectedYear,
      owner_id: user.id,
      family_id: prof?.family_id || null,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setModalVisible(false);
      resetForm();
      fetchData();
    }
    setLoading(false);
  }

  async function deleteExpense(id) {
    Alert.alert(
      'Delete',
      'Are you sure you want to delete this expense?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('onetime_expenses').delete().eq('id', id);
            if (!error) fetchData();
            else Alert.alert('Error', error.message);
          }
        }
      ]
    );
  }

  const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const catMap = {};
  categories.forEach(c => catMap[c.id] = c);

  const years = [];
  for (let y = new Date().getFullYear(); y >= new Date().getFullYear() - 5; y--) {
    years.push(y);
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/home')}>
          <Text style={styles.backBtn}>‹ Home</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>One-Time Costs 📅</Text>

      {/* Year Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yearScroll}>
        {years.map(y => (
          <TouchableOpacity
            key={y}
            style={[styles.yearChip, selectedYear === y && styles.yearChipActive]}
            onPress={() => setSelectedYear(y)}
          >
            <Text style={[styles.yearChipText, selectedYear === y && styles.yearChipTextActive]}>
              {y}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Total Card */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>{selectedYear} One-Time Total</Text>
        <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
        <Text style={styles.totalSub}>{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Add Button */}
      <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
        <Text style={styles.addBtnText}>➕ Add One-Time Expense</Text>
      </TouchableOpacity>

      {/* Expense List */}
      {expenses.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No one-time expenses for {selectedYear}</Text>
          <Text style={styles.emptySubtext}>Add insurance, taxes, gifts, etc.</Text>
        </View>
      ) : (
        expenses.map(item => {
          const cat = catMap[item.category_id];
          return (
            <View key={item.id} style={styles.expenseRow}>
              <View style={styles.expenseIcon}>
                <Text style={{ fontSize: 22 }}>{cat?.icon || '📦'}</Text>
              </View>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseDesc}>{item.description}</Text>
                <Text style={styles.expenseMeta}>
                  {item.expense_date} • {item.is_shared ? '👨‍👩‍👧 Shared' : '👤 Personal'}
                </Text>
                {cat && (
                  <Text style={[styles.catTag, { backgroundColor: (cat.color || '#ccc') + '33' }]}>
                    {cat.icon} {cat.name}
                  </Text>
                )}
                <Text style={styles.addedBy}>
                  Added by {profiles[item.owner_id]?.full_name || 'You'}
                </Text>
              </View>
              <View style={styles.expenseRight}>
                <Text style={styles.expenseAmount}>${parseFloat(item.amount).toFixed(2)}</Text>
                <TouchableOpacity onPress={() => deleteExpense(item.id)}>
                  <Text style={styles.deleteBtn}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {/* Add Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add One-Time Expense</Text>

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Car Insurance, Tax Filing"
                value={description}
                onChangeText={setDescription}
                autoFocus
              />

              <Text style={styles.label}>Amount ($)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Date</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateBtnText}>📅 {date.toDateString()}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, selected) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (selected) setDate(selected);
                  }}
                />
              )}

              <Text style={styles.label}>Type</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, !isShared && styles.toggleActive]}
                  onPress={() => setIsShared(false)}
                >
                  <Text style={[styles.toggleText, !isShared && styles.toggleTextActive]}>👤 Personal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, isShared && styles.toggleActive]}
                  onPress={() => setIsShared(true)}
                >
                  <Text style={[styles.toggleText, isShared && styles.toggleTextActive]}>👨‍👩‍👧 Shared</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Category</Text>
              <View style={styles.catGrid}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catBtn, selectedCategory === cat.id && { backgroundColor: cat.color }]}
                    onPress={() => setSelectedCategory(cat.id)}
                  >
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
  yearChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e0e0', marginRight: 8
  },
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
  catTag: { fontSize: 11, color: '#444', marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  addedBy: { fontSize: 11, color: '#999', marginTop: 2 },
  expenseRight: { alignItems: 'flex-end', gap: 6 },
  expenseAmount: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e' },
  deleteBtn: { fontSize: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 16 },
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