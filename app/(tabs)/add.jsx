import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { router, useFocusEffect } from 'expo-router';
import { TOP_MARGIN } from '../../lib/constants';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function Add() {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isShared, setIsShared] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
    }, [])
  );

  async function fetchCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    if (data) setCategories(data);
  }

  async function handleSave() {
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
    const { data: prof } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single();

    const { error } = await supabase.from('expenses').insert({
      amount: parseFloat(amount),
      description,
      category_id: selectedCategory,
      is_shared: isShared,
      expense_date: date.toISOString().split('T')[0],
      owner_id: user.id,
      family_id: prof?.family_id || null,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Expense saved!');
      setAmount('');
      setDescription('');
      setSelectedCategory(null);
      setIsShared(false);
      setDate(new Date());
      router.push('/(tabs)/home');
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Add Expense</Text>

        {/* Amount */}
        <Text style={styles.label}>Amount ($)</Text>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.input}
          placeholder="What was this for?"
          value={description}
          onChangeText={setDescription}
        />

        {/* Date */}
        <Text style={styles.label}>Date</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateBtnText}>📅 {date.toDateString()}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            key={`date-${showDatePicker}`}
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'compact' : 'default'}
            onChange={(event, selectedDate) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (selectedDate) setDate(selectedDate);
            }}
          />
        )}

        {/* Personal vs Shared */}
        <Text style={styles.label}>Type</Text>
        <View style={styles.typeToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, !isShared && styles.toggleActive]}
            onPress={() => setIsShared(false)}
          >
            <Text style={[styles.toggleText, !isShared && styles.toggleTextActive]}>
              👤 Personal
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, isShared && styles.toggleActive]}
            onPress={() => setIsShared(true)}
          >
            <Text style={[styles.toggleText, isShared && styles.toggleTextActive]}>
              👨‍👩‍👧 Shared
            </Text>
          </TouchableOpacity>
        </View>

        {/* Categories */}
        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryBtn,
                selectedCategory === cat.id && { backgroundColor: cat.color, borderColor: cat.color }
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
              <Text style={[
                styles.categoryName,
                selectedCategory === cat.id && styles.categoryNameActive
              ]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveBtnText}>
            {loading ? 'Saving...' : 'Save Expense'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a1a2e', marginTop: TOP_MARGIN, marginBottom: 24 },
  typeToggle: { flexDirection: 'row', gap: 12 },
  toggleBtn: {
    flex: 1, padding: 12, borderRadius: 12, borderWidth: 1,
    borderColor: '#e0e0e0', backgroundColor: '#fff', alignItems: 'center'
  },
  toggleActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#666' },
  toggleTextActive: { color: '#fff' },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    fontSize: 16, borderWidth: 1, borderColor: '#e0e0e0'
  },
  dateBtn: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#e0e0e0'
  },
  dateBtnText: { fontSize: 16, color: '#1a1a2e' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryBtn: {
    width: '30%', padding: 10, borderRadius: 12, borderWidth: 1,
    borderColor: '#e0e0e0', backgroundColor: '#fff', alignItems: 'center'
  },
  categoryIcon: { fontSize: 24, marginBottom: 4 },
  categoryName: { fontSize: 11, color: '#444', textAlign: 'center' },
  categoryNameActive: { color: '#fff', fontWeight: 'bold' },
  saveBtn: {
    backgroundColor: '#4f46e5', borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 24
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});