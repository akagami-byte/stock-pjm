import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '@/lib/supabase'; // <-- Sesuaikan sama path file supabase lu

// WAJIB: Ini supaya browser otomatis tutup pas nangkep deep link balikan
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // --- LOGIN PAKAI EMAIL & PASSWORD BIASA ---
  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Email dan password wajib diisi!');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Kalau sukses, listener di _layout / App.tsx bakal otomatis ngarahin ke /(tabs)
    } catch (error: any) {
      Alert.alert('Login Gagal', error.message || 'Terjadi kesalahan saat login');
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIN PAKAI GOOGLE OAUTH (EXPO WAY) ---
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // 1. Buat redirect URI otomatis sesuai environment (exp:// di Expo Go, pjmstock:// di production)
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'pjmstock',
        path: 'auth-callback',
      });

      console.log('🔗 URL Callback yang wajib terdaftar di .env VPS:', redirectUrl);

      // 2. Minta URL OAuth ke Supabase TANPA langsung buka browser (skipBrowserRedirect: true)
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true, // <-- INI KUNCINYA BIAR EXPO YANG PEGANG KENDALI
        },
      });

      if (error) throw error;

      // 3. Buka browser pakai openAuthSessionAsync supaya Expo nungguin link balikan
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        // 4. Kalau browser berhasil menangkap redirectUrl balikan dari VPS
        if (result.type === 'success' && result.url) {
          // Ambil access_token dan refresh_token dari URL balikan (biasanya ada di format #access_token=... atau ?access_token=...)
          const urlObj = new URL(result.url);
          const params = new URLSearchParams(urlObj.hash.replace('#', '') || urlObj.search);
          
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (access_token && refresh_token) {
            // Paksa Supabase simpan sesinya ke storage HP
            const { error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (sessionError) throw sessionError;
          } else {
            console.log('Sesi udah otomatis ditangkap oleh Supabase client');
          }
        }
      }
    } catch (error: any) {
      console.error('Google OAuth Error:', error);
      Alert.alert('OAuth Gagal', error.message || 'Gagal login dengan Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login PJM Stock</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleEmailLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
      </TouchableOpacity>

      <View style={styles.divider}>
        <Text style={styles.dividerText}>ATAU</Text>
      </View>

      <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin} disabled={loading}>
        <Text style={styles.googleButtonText}>🌐 Sign in with Google</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#333' },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#ddd' },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  divider: { marginVertical: 20, alignItems: 'center' },
  dividerText: { color: '#888', fontWeight: '600' },
  googleButton: { backgroundColor: '#fff', padding: 15, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#ccc' },
  googleButtonText: { color: '#333', fontWeight: 'bold', fontSize: 16 },
});