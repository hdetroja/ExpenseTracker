import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, RefreshControl, Modal
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';
import { TOP_MARGIN } from '../../lib/constants';

export default function Shopping() {
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [items, setItems] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [familyId, setFamilyId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [showNewList, setShowNewList] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [listToDelete, setListToDelete] = useState(null);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (prof?.family_id) {
      setFamilyId(prof.family_id);
      const { data: members } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', prof.family_id);
      if (members) {
        const profMap = {};
        members.forEach(m => profMap[m.id] = m);
        setProfiles(profMap);
      }
    }

    const { data: allLists } = await supabase
      .from('shopping_lists')
      .select('*')
      .or(`owner_id.eq.${user.id}${prof?.family_id ? `,and(is_shared.eq.true,family_id.eq.${prof.family_id})` : ''}`)
      .order('created_at', { ascending: false });

    if (allLists) setLists(allLists);
  }

  async function fetchItems(listId) {
    const { data } = await supabase
      .from('shopping_items')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true });
    if (data) setItems(data);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    if (selectedList) await fetchItems(selectedList.id);
    setRefreshing(false);
  }

  async function createList() {
    if (!newListName.trim()) {
      Alert.alert('Error', 'Please enter a list name');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('shopping_lists').insert({
      name: newListName.trim(),
      owner_id: user.id,
      family_id: isShared ? familyId : null,
      is_shared: isShared && !!familyId,
    }).select().single();

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setNewListName('');
      setIsShared(false);
      setShowNewList(false);
      setLists([data, ...lists]);
      openList(data);
    }
  }

  async function openList(list) {
    setSelectedList(list);
    await fetchItems(list.id);
  }

  async function addItem() {
    if (!newItemName.trim()) return;
    const { data, error } = await supabase.from('shopping_items').insert({
      list_id: selectedList.id,
      name: newItemName.trim(),
      is_checked: false,
    }).select().single();

    if (!error && data) {
      setItems([...items, data]);
      setNewItemName('');
    }
  }

  async function toggleItem(item) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('shopping_items')
      .update({
        is_checked: !item.is_checked,
        checked_by: !item.is_checked ? user.id : null,
      })
      .eq('id', item.id);

    if (!error) {
      setItems(items.map(i => i.id === item.id
        ? { ...i, is_checked: !i.is_checked, checked_by: !i.is_checked ? user.id : null }
        : i
      ));
    }
  }

  async function deleteItem(id) {
    await supabase.from('shopping_items').delete().eq('id', id);
    setItems(items.filter(i => i.id !== id));
  }

  async function deleteList(list) {
    await supabase.from('shopping_lists').delete().eq('id', list.id);
    setLists(lists.filter(l => l.id !== list.id));
    if (selectedList?.id === list.id) {
      setSelectedList(null);
      setItems([]);
    }
    setShowDeleteConfirm(false);
  }

  const checkedCount = items.filter(i => i.is_checked).length;
  const totalCount = items.length;

  // List View
  if (!selectedList) {
    return (
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={[styles.title, { marginTop: TOP_MARGIN }]}>Shopping Lists 🛒</Text>

        <TouchableOpacity style={styles.addListBtn} onPress={() => setShowNewList(true)}>
          <Text style={styles.addListBtnText}>+ New List</Text>
        </TouchableOpacity>

        {lists.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No shopping lists yet</Text>
            <Text style={styles.emptySubtext}>Tap "New List" to create one</Text>
          </View>
        ) : (
          lists.map(list => (
            <TouchableOpacity
              key={list.id}
              style={styles.listCard}
              onPress={() => openList(list)}
            >
              <View style={styles.listCardLeft}>
                <Text style={styles.listCardIcon}>
                  {list.is_shared ? '👨‍👩‍👧' : '👤'}
                </Text>
                <View>
                  <Text style={styles.listCardName}>{list.name}</Text>
                  <Text style={styles.listCardMeta}>
                    {list.is_shared ? 'Shared with family' : 'Personal'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setListToDelete(list);
                  setShowDeleteConfirm(true);
                }}
              >
                <Text style={styles.deleteBtn}>🗑️</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}

        {/* New List Modal */}
        <Modal
          visible={showNewList}
          transparent
          animationType="slide"
          onRequestClose={() => setShowNewList(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New Shopping List</Text>

              <TextInput
                style={styles.input}
                placeholder="List name (e.g. Costco, Weekly Groceries)"
                value={newListName}
                onChangeText={setNewListName}
                autoFocus
              />

              {familyId && (
                <>
                  <Text style={styles.label}>Share with family?</Text>
                  <View style={styles.toggleRow}>
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
                        👨‍👩‍👧 Family
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowNewList(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={createList}>
                  <Text style={styles.saveBtnText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Delete Confirm Modal */}
        <Modal
          visible={showDeleteConfirm}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteConfirm(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Delete List?</Text>
              <Text style={styles.modalSub}>
                Delete "{listToDelete?.name}"? All items will be lost.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDeleteConfirm(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: '#FF6B6B' }]}
                  onPress={() => deleteList(listToDelete)}
                >
                  <Text style={styles.saveBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // Items View
  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.itemsHeader}>
        <TouchableOpacity onPress={() => { setSelectedList(null); setItems([]); }}>
          <Text style={styles.backBtn}>‹ Lists</Text>
        </TouchableOpacity>
        {selectedList.is_shared && (
          <Text style={styles.sharedBadge}>👨‍👩‍👧 Shared</Text>
        )}
      </View>

      <Text style={styles.title}>{selectedList.name}</Text>

      {/* Progress */}
      {totalCount > 0 && (
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>{checkedCount} of {totalCount} items</Text>
            <Text style={styles.progressPct}>
              {Math.round((checkedCount / totalCount) * 100)}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {
              width: `${(checkedCount / totalCount) * 100}%`
            }]} />
          </View>
        </View>
      )}

      {/* Add Item */}
      <View style={styles.addItemRow}>
        <TextInput
          style={styles.addItemInput}
          placeholder="Add an item..."
          value={newItemName}
          onChangeText={setNewItemName}
          onSubmitEditing={addItem}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
          <Text style={styles.addItemBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Items */}
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No items yet</Text>
          <Text style={styles.emptySubtext}>Type above to add items</Text>
        </View>
      ) : (
        <View style={styles.itemsList}>
          {/* Unchecked items */}
          {items.filter(i => !i.is_checked).map(item => (
            <View key={item.id} style={styles.itemRow}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => toggleItem(item)}
              >
                <Text style={styles.checkboxIcon}>⬜</Text>
              </TouchableOpacity>
              <Text style={styles.itemName}>{item.name}</Text>
              <TouchableOpacity onPress={() => deleteItem(item.id)}>
                <Text style={styles.deleteBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Checked items */}
          {items.filter(i => i.is_checked).length > 0 && (
            <>
              <Text style={styles.checkedHeader}>
                ✅ Checked ({items.filter(i => i.is_checked).length})
              </Text>
              {items.filter(i => i.is_checked).map(item => (
                <View key={item.id} style={[styles.itemRow, styles.itemRowChecked]}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => toggleItem(item)}
                  >
                    <Text style={styles.checkboxIcon}>✅</Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemName, styles.itemNameChecked]}>
                      {item.name}
                    </Text>
                    {item.checked_by && profiles[item.checked_by] && (
                      <Text style={styles.checkedBy}>
                        by {profiles[item.checked_by]?.full_name || 'Someone'}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => deleteItem(item.id)}>
                    <Text style={styles.deleteBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a1a2e', marginHorizontal: 16, marginBottom: 16 },
  addListBtn: {
    backgroundColor: '#4f46e5', marginHorizontal: 16, borderRadius: 12,
    padding: 16, alignItems: 'center', marginBottom: 16
  },
  addListBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#999' },
  listCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10,
    borderRadius: 16, padding: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between'
  },
  listCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listCardIcon: { fontSize: 28 },
  listCardName: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  listCardMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  deleteBtn: { fontSize: 18, color: '#999' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 16 },
  modalSub: { fontSize: 14, color: '#666', marginBottom: 16 },
  input: { backgroundColor: '#f0f4ff', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8 },
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  toggleBtn: {
    flex: 1, padding: 12, borderRadius: 12, borderWidth: 1,
    borderColor: '#e0e0e0', backgroundColor: '#fff', alignItems: 'center'
  },
  toggleActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#666' },
  toggleTextActive: { color: '#fff' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  saveBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#4f46e5', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  itemsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginTop: TOP_MARGIN, marginBottom: 8
  },
  backBtn: { fontSize: 16, color: '#4f46e5', fontWeight: '600' },
  sharedBadge: { fontSize: 13, color: '#4f46e5', fontWeight: '600' },
  progressCard: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 16 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressText: { fontSize: 14, color: '#666' },
  progressPct: { fontSize: 14, fontWeight: 'bold', color: '#4f46e5' },
  progressTrack: { height: 8, backgroundColor: '#f0f4ff', borderRadius: 4 },
  progressFill: { height: 8, backgroundColor: '#4f46e5', borderRadius: 4 },
  addItemRow: { flexDirection: 'row', marginHorizontal: 16, gap: 8, marginBottom: 16 },
  addItemInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14,
    fontSize: 15, borderWidth: 1, borderColor: '#e0e0e0'
  },
  addItemBtn: { backgroundColor: '#4f46e5', borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
  addItemBtnText: { color: '#fff', fontWeight: '600' },
  itemsList: { marginHorizontal: 16 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 12, marginBottom: 8, gap: 12
  },
  itemRowChecked: { opacity: 0.6 },
  checkbox: { width: 28, alignItems: 'center' },
  checkboxIcon: { fontSize: 20 },
  itemName: { flex: 1, fontSize: 15, color: '#1a1a2e' },
  itemNameChecked: { textDecorationLine: 'line-through', color: '#999' },
  checkedBy: { fontSize: 11, color: '#999', marginTop: 2 },
  checkedHeader: { fontSize: 13, fontWeight: '600', color: '#999', marginBottom: 8, marginTop: 4 },
});