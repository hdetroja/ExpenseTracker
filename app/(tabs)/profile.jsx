import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, RefreshControl, Share
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect, router } from 'expo-router';
import { TOP_MARGIN } from '../../lib/constants';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [family, setFamily] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [fullName, setFullName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [visibleTo, setVisibleTo] = useState([]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  async function fetchVisibility(userId) {
    const { data } = await supabase
      .from('expense_visibility')
      .select('viewer_id')
      .eq('owner_id', userId);
    if (data) setVisibleTo(data.map(v => v.viewer_id));
  }

  async function toggleVisibility(memberId) {
    if (!user) return;
    if (visibleTo.includes(memberId)) {
      await supabase
        .from('expense_visibility')
        .delete()
        .eq('owner_id', user.id)
        .eq('viewer_id', memberId);
      setVisibleTo(visibleTo.filter(id => id !== memberId));
    } else {
      await supabase
        .from('expense_visibility')
        .insert({ owner_id: user.id, viewer_id: memberId });
      setVisibleTo([...visibleTo, memberId]);
    }
  }

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (!user) return;

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (prof) {
      setProfile(prof);
      setFullName(prof.full_name || '');

      if (prof.family_id) {
        const { data: fam } = await supabase
          .from('families')
          .select('*')
          .eq('id', prof.family_id)
          .single();
        if (fam) setFamily(fam);

        const { data: members } = await supabase
          .from('profiles')
          .select('*')
          .eq('family_id', prof.family_id);
        if (members) setFamilyMembers(members);
        await fetchVisibility(user.id);
      }
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  async function updateName() {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', user.id);

    if (error) Alert.alert('Error', error.message);
    else {
      setEditingName(false);
      fetchData();
    }
    setLoading(false);
  }

  async function createFamily() {
    if (!familyName.trim()) {
      Alert.alert('Error', 'Please enter a family name');
      return;
    }
    setLoading(true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    const { data: fam, error } = await supabase
      .from('families')
      .insert({ name: familyName.trim(), created_by: user.id })
      .select()
      .single();

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      await supabase
        .from('profiles')
        .update({ family_id: fam.id })
        .eq('id', user.id);
      setFamilyName('');
      fetchData();
    }
    setLoading(false);
  }

  async function joinFamily() {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }
    setLoading(true);

    const { data: fam, error } = await supabase
      .rpc('find_family_by_invite_code', { code: inviteCode.trim() })
      .single();

    if (error || !fam) {
      Alert.alert('Error', 'Invalid invite code. Please check and try again.');
    } else {
      await supabase
        .from('profiles')
        .update({ family_id: fam.id })
        .eq('id', user.id);
      setInviteCode('');
      Alert.alert('Success', `You joined ${fam.name}!`);
      fetchData();
    }
    setLoading(false);
  }

  async function shareInviteCode() {
    if (!family?.invite_code) return;
    await Share.share({
      message: `Join my family on ExpenseTracker! Use invite code: ${family.invite_code.toUpperCase()}`
    });
  }

  async function leaveFamily() {
    Alert.alert(
      'Leave Family',
      'Are you sure you want to leave this family?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave', style: 'destructive',
          onPress: async () => {
            await supabase
              .from('profiles')
              .update({ family_id: null })
              .eq('id', user.id);
            setFamily(null);
            setFamilyMembers([]);
            fetchData();
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
      <View style={styles.titleRow}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/settings')}>
          <Text style={styles.backBtn}>‹ Settings</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>Profile 👤</Text>

      {/* Profile Card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your Profile</Text>

        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.full_name || user?.email || '?')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{profile?.full_name || 'No name set'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
          <TouchableOpacity onPress={() => setEditingName(!editingName)}>
            <Text style={styles.editBtn}>✏️</Text>
          </TouchableOpacity>
        </View>

        {editingName && (
          <View style={styles.editRow}>
            <TextInput
              style={styles.input}
              placeholder="Your full name"
              value={fullName}
              onChangeText={setFullName}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={updateName}>
              <Text style={styles.saveBtnText}>{loading ? '...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Family Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Family / Group</Text>

        {family ? (
          <>
            {/* Family Info */}
            <View style={styles.familyHeader}>
              <View>
                <Text style={styles.familyName}>👨‍👩‍👧 {family.name}</Text>
                <Text style={styles.familyMeta}>{familyMembers.length} member{familyMembers.length !== 1 ? 's' : ''}</Text>
              </View>
              <TouchableOpacity style={styles.leaveBtn} onPress={leaveFamily}>
                <Text style={styles.leaveBtnText}>Leave</Text>
              </TouchableOpacity>
            </View>

            {/* Invite Code */}
            <View style={styles.inviteBox}>
              <View>
                <Text style={styles.inviteLabel}>Invite Code</Text>
                <Text style={styles.inviteCode}>{family.invite_code?.toUpperCase()}</Text>
              </View>
              <TouchableOpacity style={styles.shareBtn} onPress={shareInviteCode}>
                <Text style={styles.shareBtnText}>📤 Share</Text>
              </TouchableOpacity>
            </View>

            {/* Members */}
            <Text style={styles.membersTitle}>Members</Text>
            {familyMembers.map(member => (
              <View key={member.id} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {(member.full_name || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>
                    {member.full_name || 'Unknown'} {member.id === user?.id ? '(You)' : ''}
                  </Text>
                </View>
                {member.id !== user?.id && (
                  <TouchableOpacity
                    style={[
                      styles.accessBtn,
                      visibleTo.includes(member.id) && styles.accessBtnActive
                    ]}
                    onPress={() => toggleVisibility(member.id)}
                  >
                    <Text style={[
                      styles.accessBtnText,
                      visibleTo.includes(member.id) && styles.accessBtnTextActive
                    ]}>
                      {visibleTo.includes(member.id) ? '👁️ Seeing my personal' : '🔒 Private'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </>
        ) : (
          <>
            {/* Create Family */}
            <Text style={styles.label}>Create a new family/group</Text>
            <View style={styles.editRow}>
              <TextInput
                style={styles.input}
                placeholder="Family name (e.g. The Smiths)"
                value={familyName}
                onChangeText={setFamilyName}
              />
              <TouchableOpacity style={styles.saveBtn} onPress={createFamily}>
                <Text style={styles.saveBtnText}>{loading ? '...' : 'Create'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Join Family */}
            <Text style={styles.label}>Join an existing family/group</Text>
            <View style={styles.editRow}>
              <TextInput
                style={styles.input}
                placeholder="Enter invite code"
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.saveBtn} onPress={joinFamily}>
                <Text style={styles.saveBtnText}>{loading ? '...' : 'Join'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a1a2e', marginTop: 60, marginHorizontal: 16, marginBottom: 16 },
  card: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 16 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  userEmail: { fontSize: 13, color: '#999', marginTop: 2 },
  editBtn: { fontSize: 20 },
  editRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  input: { flex: 1, backgroundColor: '#f0f4ff', borderRadius: 10, padding: 12, fontSize: 14 },
  saveBtn: { backgroundColor: '#4f46e5', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  label: { fontSize: 14, color: '#666', marginBottom: 8 },
  familyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  familyName: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  familyMeta: { fontSize: 13, color: '#999', marginTop: 2 },
  leaveBtn: { borderWidth: 1, borderColor: '#FF6B6B', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  leaveBtnText: { color: '#FF6B6B', fontSize: 13, fontWeight: '600' },
  inviteBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f4ff', borderRadius: 12, padding: 16, marginBottom: 16 },
  inviteLabel: { fontSize: 12, color: '#999', marginBottom: 4 },
  inviteCode: { fontSize: 24, fontWeight: 'bold', color: '#4f46e5', letterSpacing: 4 },
  shareBtn: { backgroundColor: '#4f46e5', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  shareBtnText: { color: '#fff', fontWeight: '600' },
  membersTitle: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f0f4ff' },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { color: '#4f46e5', fontSize: 16, fontWeight: 'bold' },
  memberName: { fontSize: 14, color: '#1a1a2e' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e0e0e0' },
  dividerText: { fontSize: 12, color: '#999' },
  accessBtn: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#f0f4ff'
  },
  accessBtnActive: { backgroundColor: '#ede9fe', borderColor: '#4f46e5' },
  accessBtnText: { fontSize: 11, color: '#999' },
  accessBtnTextActive: { color: '#4f46e5', fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { fontSize: 18, color: '#4f46e5', fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: TOP_MARGIN, marginHorizontal: 16, paddingTop: 10 },
  backBtn: { fontSize: 16, color: '#4f46e5', fontWeight: '600' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a1a2e', marginHorizontal: 16, marginBottom: 16 },
});