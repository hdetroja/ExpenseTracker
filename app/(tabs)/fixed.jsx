import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, RefreshControl, Modal, Switch
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { TOP_MARGIN } from '../../lib/constants';

export default function Fixed() {
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isShared, setIsShared] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  async function fetchData() {
    const { data: cats } = await supabase.from('categories').select('*').order('name');
    if (cats) setCategories(cats);

    const { data: fixed } = await supabase
      .from('fixed_expenses')
      .select('*')
      .order('day_of_month');
    if (fixed) setFixedExpenses(fixed);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  async function addFixedExpense() {
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }
    if (!amount || isNaN(parseFloat(amount))) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const { error } = await supabase.from('fixed_expenses').insert({
      description: description.trim(),
      amount: parseFloat(amount),
      category_id: selectedCategory,
      day_of_month: parseInt(dayOfMonth) || 1,
      is_shared: isShared,
      is_active: true,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setModalVisible(false);
      setDescription('');
      setAmount('');
      setDayOfMonth('1');
      setSelectedCategory(null);
      setIsShared(false);
      fetchData();
    }
  }

  async function toggleActive(id, currentValue) {
    await supabase.from('fixed_expenses')
      .update({ is_active: !currentValue })
      .eq('id', id);
    fetchData();
  }

  async function deleteFixed(id, name) {
    Alert.alert(
      'Delete',
      `Delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await supabase.from('fixed_expenses').delete().eq('id', id);
            fetchData();
          }
        }
      ]
    );
  }

  async function addToExpenses(item) {
    const cat = categories.find(c => c.id === item.category_id);
    const { error } = await supabase.from('expenses').insert({
      amount: item.amount,
      description: item.description,
      category_id: item.category_id,
      is_shared: item.is_shared,
      expense_date: new Date().toISOString().split('T')[0],
    });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', `"${item.description}" added to this month's expenses!`);
    }
  }

  const totalMonthly = fixedExpenses
    .filter(e => e.is_active)
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const catMap = {};
  categories.forEach(c => catMap[c.id] = c);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Fixed Expenses 🔁</Text>

      {/* Monthly Total */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Monthly Committed</Text>
        <Text style={styles.totalAmount}>${totalMonthly.toFixed(2)}</Text>
        <Text style={styles.totalSub}>
          {fixedExpenses.filter(e => e.is_active).length} active recurring expenses
        </Text>
      </View>

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.addBtnText}>+ Add Fixed Expense</Text>
      </TouchableOpacity>

      {/* Fixed Expense List */}
      {fixedExpenses.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No fixed expenses yet</Text>
          <Text style={styles.emptySubtext}>Add rent, wifi, subscriptions etc.</Text>
        </View>
      ) : (
        fixedExpenses.map(item => {
          const cat = catMap[item.category_id];
          return (
            <View key={item.id} style={[styles.card, !item.is_active && styles.cardInactive]}>
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardIcon}>{cat?.icon || '📦'}</Text>
                  <View>
                    <Text style={styles.cardName}>{item.description}</Text>
                    <Text style={styles.cardMeta}>
                      Due day {item.day_of_month} • {item.is_shared ? '👨‍👩‍👧 Shared' : '👤 Personal'}
                    </Text>
                    {cat && <Text style={styles.cardCat}>{cat.name}</Text>}
                  </View>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.cardAmount}>${parseFloat(item.amount).toFixed(2)}</Text>
                  <Text style={styles.cardFreq}>/ month</Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => addToExpenses(item)}
                >
                  <Text style={styles.actionBtnText}>➕ Add to Month</Text>
                </TouchableOpacity>

                <Switch
                  value={item.is_active}
                  onValueChange={() => toggleActive(item.id, item.is_active)}
                  trackColor={{ false: '#ddd', true: '#4f46e5' }}
                />

                <TouchableOpacity onPress={() => deleteFixed(item.id, item.description)}>
                  <Text style={{ fontSize: 18 }}>🗑️</Text>
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
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Fixed Expense</Text>

            <TextInput
              style={styles.input}
              placeholder="Description (e.g. Rent, WiFi)"
              value={description}
              onChangeText={setDescription}
            />

            <TextInput
              style={styles.input}
              placeholder="Amount ($)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />

            <TextInput
              style={styles.input}
              placeholder="Due day of month (1-31)"
              value={dayOfMonth}
              onChangeText={setDayOfMonth}
              keyboardType="number-pad"
            />

            <Text style={styles.label}>Type</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, !isShared && styles.toggleActive]}
                onPress={() => setIsShared(false)}
              >
                <Text style={[styles.toggleText, !isShared && styles.toggleTextActive]}>Personal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, isShared && styles.toggleActive]}
                onPress={() => setIsShared(true)}
              >
                <Text style={[styles.toggleText, isShared && styles.toggleTextActive]}>Shared</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Category</Text>
            <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
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
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={addFixedExpense}>
                <Text style={styles.saveBtnText}>Save</Text>
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
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a1a2e', marginTop: TOP_MARGIN, marginHorizontal: 16, marginBottom: 16 },
  totalCard: { backgroundColor: '#4f46e5', margin: 16, borderRadius: 20, padding: 24, alignItems: 'center' },
  totalLabel: { color: '#c7d2fe', fontSize: 14, marginBottom: 8 },
  totalAmount: { color: '#fff', fontSize: 42, fontWeight: 'bold' },
  totalSub: { color: '#c7d2fe', fontSize: 12, marginTop: 4 },
  addBtn: { backgroundColor: '#4f46e5', marginHorizontal: 16, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#999' },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16 },
  cardInactive: { opacity: 0.5 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cardIcon: { fontSize: 28 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  cardMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  cardCat: { fontSize: 11, color: '#4f46e5', marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  cardAmount: { fontSize: 18, fontWeight: 'bold', color: '#1a1a2e' },
  cardFreq: { fontSize: 11, color: '#999' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#f0f4ff', paddingTop: 12 },
  actionBtn: { flex: 1, backgroundColor: '#ede9fe', borderRadius: 8, padding: 8, alignItems: 'center' },
  actionBtnText: { color: '#4f46e5', fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 16 },
  input: { backgroundColor: '#f0f4ff', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8 },
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