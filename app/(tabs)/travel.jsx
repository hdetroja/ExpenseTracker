import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, RefreshControl, Modal, Platform
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect, router } from 'expo-router';
import { TOP_MARGIN } from '../../lib/constants';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function Travel() {
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  // New trip form
  const [showTripModal, setShowTripModal] = useState(false);
  const [tripName, setTripName] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [tripIsShared, setTripIsShared] = useState(false);

  // New expense form
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isShared, setIsShared] = useState(false);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchTrips();
      fetchCategories();
      fetchProfiles();
    }, [])
  );

  async function fetchTrips() {
    const { data } = await supabase
      .from('trips')
      .select('*, travel_expenses(amount)')
      .order('start_date', { ascending: false });
    if (data) setTrips(data);
  }

  async function fetchCategories() {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data);
  }

  async function fetchProfiles() {
    const { data } = await supabase.from('profiles').select('*');
    if (data) {
      const profMap = {};
      data.forEach(p => profMap[p.id] = p);
      setProfiles(profMap);
    }
  }

  async function fetchTripExpenses(tripId) {
    const { data } = await supabase
      .from('travel_expenses')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });
    if (data) setExpenses(data);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchTrips();
    if (selectedTrip) await fetchTripExpenses(selectedTrip.id);
    setRefreshing(false);
  }

  async function createTrip() {
    if (!tripName.trim()) {
      Alert.alert('Error', 'Please enter a trip name');
      return;
    }
    if (endDate < startDate) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('profiles').select('family_id').eq('id', user.id).single();

    const { data, error } = await supabase.from('trips').insert({
      name: tripName.trim(),
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      owner_id: user.id,
      family_id: prof?.family_id,
      is_shared: tripIsShared,
    }).select().single();

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setShowTripModal(false);
      setTripName('');
      setStartDate(new Date());
      setEndDate(new Date());
      setTripIsShared(false);
      fetchTrips();
      openTrip(data);
    }
    setLoading(false);
  }

  async function openTrip(trip) {
    setSelectedTrip(trip);
    await fetchTripExpenses(trip.id);
  }

  function resetExpenseForm() {
    setAmount('');
    setDescription('');
    setSelectedCategory(null);
    setIsShared(selectedTrip?.is_shared || false);
  }

  async function addExpenseToTrip() {
    if (!amount || isNaN(parseFloat(amount))) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('travel_expenses').insert({
      amount: parseFloat(amount),
      description,
      category_id: selectedCategory,
      is_shared: isShared,
      trip_id: selectedTrip.id,
      trip_name: selectedTrip.name,
      expense_date: selectedTrip.start_date,
      owner_id: user.id,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setShowExpenseModal(false);
      resetExpenseForm();
      fetchTripExpenses(selectedTrip.id);
      fetchTrips();
    }
    setLoading(false);
  }

  async function deleteExpense(id) {
    Alert.alert('Delete', 'Delete this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('travel_expenses').delete().eq('id', id);
          fetchTripExpenses(selectedTrip.id);
          fetchTrips();
        }
      }
    ]);
  }

  async function deleteTrip(trip) {
    Alert.alert('Delete Trip', `Delete "${trip.name}" and all its expenses?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('trips').delete().eq('id', trip.id);
          if (selectedTrip?.id === trip.id) {
            setSelectedTrip(null);
            setExpenses([]);
          }
          fetchTrips();
        }
      }
    ]);
  }

  const catMap = {};
  categories.forEach(c => catMap[c.id] = c);

  function formatDateRange(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    const opts = { month: 'short', day: 'numeric' };
    if (s.getFullYear() === e.getFullYear()) {
      return `${s.toLocaleDateString('en-US', opts)} - ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
    }
    return `${s.toLocaleDateString('en-US', { ...opts, year: 'numeric' })} - ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
  }

  // Trip List View
  if (!selectedTrip) {
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
        <Text style={styles.title}>Travel ✈️</Text>

        <TouchableOpacity style={styles.addBtn} onPress={() => setShowTripModal(true)}>
          <Text style={styles.addBtnText}>➕ New Trip</Text>
        </TouchableOpacity>

        {trips.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No trips yet</Text>
            <Text style={styles.emptySubtext}>Tap "New Trip" to start tracking travel expenses</Text>
          </View>
        ) : (
          trips.map(trip => {
            const total = (trip.travel_expenses || []).reduce((sum, e) => sum + parseFloat(e.amount), 0);
            return (
              <TouchableOpacity key={trip.id} style={styles.tripListCard} onPress={() => openTrip(trip)}>
                <Text style={styles.tripListIcon}>{trip.is_shared ? '👨‍👩‍👧' : '👤'}</Text>
                <View style={styles.tripListInfo}>
                  <Text style={styles.tripListName}>🧳 {trip.name}</Text>
                  <Text style={styles.tripListDates}>{formatDateRange(trip.start_date, trip.end_date)}</Text>
                </View>
                <Text style={styles.tripListTotal}>${total.toFixed(2)}</Text>
                <TouchableOpacity onPress={() => deleteTrip(trip)}>
                  <Text style={styles.deleteBtn}>🗑️</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}

        {/* New Trip Modal */}
        <Modal visible={showTripModal} transparent animationType="slide" onRequestClose={() => setShowTripModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New Trip</Text>

              <Text style={styles.label}>Trip Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Hawaii Trip"
                value={tripName}
                onChangeText={setTripName}
                autoFocus
              />

              <Text style={styles.label}>Start Date</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
                <Text style={styles.dateBtnText}>📅 {startDate.toDateString()}</Text>
              </TouchableOpacity>
              {showStartPicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, selected) => {
                    setShowStartPicker(Platform.OS === 'ios');
                    if (selected) setStartDate(selected);
                  }}
                />
              )}

              <Text style={styles.label}>End Date</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEndPicker(true)}>
                <Text style={styles.dateBtnText}>📅 {endDate.toDateString()}</Text>
              </TouchableOpacity>
              {showEndPicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, selected) => {
                    setShowEndPicker(Platform.OS === 'ios');
                    if (selected) setEndDate(selected);
                  }}
                />
              )}

              <Text style={styles.label}>Type</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, !tripIsShared && styles.toggleActive]}
                  onPress={() => setTripIsShared(false)}
                >
                  <Text style={[styles.toggleText, !tripIsShared && styles.toggleTextActive]}>👤 Personal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, tripIsShared && styles.toggleActive]}
                  onPress={() => setTripIsShared(true)}
                >
                  <Text style={[styles.toggleText, tripIsShared && styles.toggleTextActive]}>👨‍👩‍👧 Shared</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowTripModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={createTrip} disabled={loading}>
                  <Text style={styles.saveBtnText}>{loading ? '...' : 'Create Trip'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // Trip Detail View
  const tripTotal = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { setSelectedTrip(null); setExpenses([]); }}>
          <Text style={styles.backBtn}>‹ Trips</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>🧳 {selectedTrip.name}</Text>
      <Text style={styles.tripDates}>{formatDateRange(selectedTrip.start_date, selectedTrip.end_date)}</Text>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Trip Total</Text>
        <Text style={styles.totalAmount}>${tripTotal.toFixed(2)}</Text>
        <Text style={styles.totalSub}>{expenses.length} expenses</Text>
      </View>

      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => { resetExpenseForm(); setShowExpenseModal(true); }}
      >
        <Text style={styles.addBtnText}>➕ Add Expense</Text>
      </TouchableOpacity>

      {expenses.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No expenses yet</Text>
          <Text style={styles.emptySubtext}>Tap "Add Expense" to start logging</Text>
        </View>
      ) : (
        expenses.map(item => {
          const cat = catMap[item.category_id];
          return (
            <View key={item.id} style={styles.expenseRow}>
              <Text style={styles.expenseIcon}>{cat?.icon || '📦'}</Text>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseDesc}>{item.description || cat?.name || 'Expense'}</Text>
                <Text style={styles.expenseMeta}>
                  {item.is_shared ? '👨‍👩‍👧 Shared' : '👤 Personal'} • {profiles[item.owner_id]?.full_name || 'You'}
                </Text>
              </View>
              <Text style={styles.expenseAmount}>${parseFloat(item.amount).toFixed(2)}</Text>
              <TouchableOpacity onPress={() => deleteExpense(item.id)}>
                <Text style={styles.deleteBtn}>🗑️</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}

      {/* Add Expense Modal */}
      <Modal visible={showExpenseModal} transparent animationType="slide" onRequestClose={() => setShowExpenseModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Expense to {selectedTrip.name}</Text>

              <Text style={styles.label}>Amount ($)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                autoFocus
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.input}
                placeholder="What was this for?"
                value={description}
                onChangeText={setDescription}
              />

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
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowExpenseModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={addExpenseToTrip} disabled={loading}>
                  <Text style={styles.saveBtnText}>{loading ? '...' : 'Add'}</Text>
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
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a1a2e', marginHorizontal: 16, marginTop: 8 },
  tripDates: { fontSize: 14, color: '#666', marginHorizontal: 16, marginTop: 4, marginBottom: 8 },
  addBtn: { backgroundColor: '#4f46e5', marginHorizontal: 16, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16, marginBottom: 16 },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#999' },
  tripListCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginHorizontal: 16, marginBottom: 10, borderRadius: 16, padding: 16, gap: 10
  },
  tripListIcon: { fontSize: 22 },
  tripListInfo: { flex: 1 },
  tripListName: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  tripListDates: { fontSize: 12, color: '#999', marginTop: 2 },
  tripListTotal: { fontSize: 15, fontWeight: 'bold', color: '#4f46e5' },
  totalCard: { backgroundColor: '#4f46e5', marginHorizontal: 16, borderRadius: 20, padding: 24, alignItems: 'center' },
  totalLabel: { color: '#c7d2fe', fontSize: 14, marginBottom: 8 },
  totalAmount: { color: '#fff', fontSize: 42, fontWeight: 'bold' },
  totalSub: { color: '#c7d2fe', fontSize: 12, marginTop: 4 },
  expenseRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 12, gap: 10
  },
  expenseIcon: { fontSize: 20 },
  expenseInfo: { flex: 1 },
  expenseDesc: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  expenseMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  expenseAmount: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e' },
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