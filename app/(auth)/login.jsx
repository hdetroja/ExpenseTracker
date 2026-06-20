import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function nameToEmail(name) {
    const cleaned = name.trim().toLowerCase().replace(/\s+/g, '.');
    return `${cleaned}@expensetracker.app`;
  }

  async function handleAuth() {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const email = nameToEmail(fullName);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim() } }
      });
      if (error) Alert.alert('Error', error.message);
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) Alert.alert('Error', 'Name or password is incorrect');
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.logo}>💰</Text>
        <Text style={styles.title}>ExpenseTracker</Text>
        <Text style={styles.subtitle}>
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Your full name"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
        />

        <View style={styles.passwordRow}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password (min 6 characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="oneTimeCode"
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        {isSignUp && (
          <Text style={styles.hint}>
            💡 Remember your name and password exactly — you'll need them to log back in
          </Text>
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleAuth}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Login'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
          <Text style={styles.switchText}>
            {isSignUp
              ? 'Already have an account? Login'
              : "New here? Create Account"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', padding: 24,
    backgroundColor: '#f0f4ff'
  },
  logo: { fontSize: 64, textAlign: 'center', marginBottom: 8 },
  title: {
    fontSize: 32, fontWeight: 'bold', textAlign: 'center',
    color: '#1a1a2e', marginBottom: 8
  },
  subtitle: {
    fontSize: 16, textAlign: 'center', color: '#666', marginBottom: 32
  },
  input: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 16, fontSize: 16, borderWidth: 1, borderColor: '#e0e0e0'
  },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#e0e0e0'
  },
  passwordInput: { flex: 1, padding: 16, fontSize: 16 },
  eyeBtn: { paddingHorizontal: 16 },
  eyeText: { fontSize: 18 },
  hint: {
    fontSize: 13, color: '#666', backgroundColor: '#ede9fe',
    padding: 12, borderRadius: 10, marginBottom: 16, lineHeight: 18
  },
  button: {
    backgroundColor: '#4f46e5', borderRadius: 12,
    padding: 16, alignItems: 'center', marginBottom: 16
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  switchText: { textAlign: 'center', color: '#4f46e5', fontSize: 14 }
});