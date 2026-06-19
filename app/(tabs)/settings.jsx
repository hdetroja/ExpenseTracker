import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, RefreshControl, Modal
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect, router } from 'expo-router';
import { TOP_MARGIN } from '../../lib/constants';

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FF6B9D',
  '#C7B8EA', '#87CEEB', '#FFD93D', '#FF8B94', '#A8E6CF', '#FFB347', '#B0B0B0'];

const ICONS = ['🛒', '⛽', '🏪', '🍽️', '📱', '🏠', '📶', '💡', '🏥',
  '🎬', '✈️', '📦', '🎓', '👕', '💊', '🐾', '🎮', '💰'];

export default function Settings() {
  const [categories, setCategories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
    }, [])
  );

  async function fetchCategories() {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchCategories();
    setRefreshing(false);
  }

  async function addCategory() {
    if (!newCatName.trim()) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }
    const { error } = await supabase.from('categories').insert({
      name: newCatName.trim(),
      icon: selectedIcon,
      color: selectedColor,
      is_default: false,
    });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setModalVisible(false);
      setNewCatName('');
      setSelectedColor(COLORS[0]);
      setSelectedIcon(ICONS[0]);
      fetchCategories();
    }
  }

  async function deleteCategory(id, name) {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('categories').delete().eq('id', id);
            if (!error) fetchCategories();
          }
        }
      ]
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Settings ⚙️</Text>

      {/* Profile Link */}
      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => router.push('/(tabs)/profile')}
      >
        <Text style={styles.menuIcon}>👤</Text>
        <View style={styles.menuInfo}>
          <Text style={styles.menuTitle}>Profile & Family</Text>
          <Text style={styles.menuSub}>Manage your profile, family group and sharing</Text>
        </View>
        <Text style={styles.menuArrow}>›</Text>
      </TouchableOpacity>

      {/* Categories — Collapsible */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setCategoriesExpanded(!categoriesExpanded)}
        >
          <Text style={styles.sectionTitle}>🏷️ Categories ({categories.length})</Text>
          <View style={styles.sectionHeaderRight}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
            <Text style={styles.chevron}>{categoriesExpanded ? '▲' : '▼'}</Text>
          </View>
        </TouchableOpacity>

        {categoriesExpanded && (
          <View style={styles.categoryList}>
            {categories.map(cat => (
              <View key={cat.id} style={styles.categoryRow}>
                <View style={[styles.iconCircle, { backgroundColor: cat.color + '33' }]}>
                  <Text style={{ fontSize: 20 }}>{cat.icon}</Text>
                </View>
                <Text style={styles.catName}>{cat.name}</Text>
                <TouchableOpacity onPress={() => deleteCategory(cat.id, cat.name)}>
                  <Text style={styles.deleteBtn}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={async () => await supabase.auth.signOut()}
      >
        <Text style={styles.logoutText}>🚪 Logout</Text>
      </TouchableOpacity>

      {/* Add Category Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Category</Text>

            <TextInput
              style={styles.input}
              placeholder="Category name"
              value={newCatName}
              onChangeText={setNewCatName}
            />

            <Text style={styles.label}>Pick an Icon</Text>
            <View style={styles.iconGrid}>
              {ICONS.map(icon => (
                <TouchableOpacity
                  key={icon}
                  style={[styles.iconOption, selectedIcon === icon && styles.iconOptionActive]}
                  onPress={() => setSelectedIcon(icon)}
                >
                  <Text style={{ fontSize: 22 }}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Pick a Color</Text>
            <View style={styles.colorGrid}>
              {COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorCircle, { backgroundColor: color },
                    selectedColor === color && styles.colorCircleActive]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>

            <View style={styles.preview}>
              <View style={[styles.iconCircle, { backgroundColor: selectedColor + '33' }]}>
                <Text style={{ fontSize: 20 }}>{selectedIcon}</Text>
              </View>
              <Text style={styles.previewText}>{newCatName || 'Preview'}</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={addCategory}>
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
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a1a2e', marginTop: TOP_MARGIN, marginHorizontal: 16, marginBottom: 24 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 12
  },
  menuIcon: { fontSize: 24, marginRight: 12 },
  menuInfo: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  menuSub: { fontSize: 12, color: '#999', marginTop: 2 },
  menuArrow: { fontSize: 22, color: '#999' },
  section: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chevron: { fontSize: 12, color: '#999' },
  categoryList: { paddingHorizontal: 16, paddingBottom: 8 },
  addBtn: { backgroundColor: '#4f46e5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f0f4ff' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  catName: { flex: 1, fontSize: 14, color: '#1a1a2e', marginLeft: 12 },
  deleteBtn: { fontSize: 18 },
  logoutBtn: {
    backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16,
    padding: 16, alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: '#FF6B6B'
  },
  logoutText: { color: '#FF6B6B', fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 16 },
  input: { backgroundColor: '#f0f4ff', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  iconOption: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#f0f4ff', alignItems: 'center', justifyContent: 'center' },
  iconOptionActive: { backgroundColor: '#4f46e5' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  colorCircle: { width: 32, height: 32, borderRadius: 16 },
  colorCircleActive: { borderWidth: 3, borderColor: '#1a1a2e' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f0f4ff', padding: 12, borderRadius: 12, marginBottom: 16 },
  previewText: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  saveBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#4f46e5', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600' }
});