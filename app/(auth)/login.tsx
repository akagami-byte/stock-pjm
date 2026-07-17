import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '@/stores/authStore'
import { colors, typography, radius, spacing } from '@/constants'
import { Icon } from '@/components/ui/Icon'
import Svg, { Path } from 'react-native-svg'
import { LOGO_S3_URL } from './welcome'

// Custom high-fidelity Google Icon SVG
const GoogleIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" style={styles.socialIcon}>
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </Svg>
)

// Custom high-fidelity Apple Icon SVG
const AppleIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="#000000" style={styles.socialIcon}>
    <Path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.82M15.97 4.17c.66-.81 1.11-1.92.99-3.03-.96.04-2.13.64-2.82 1.45-.6.69-1.12 1.8-1 2.9 1.07.08 2.17-.51 2.83-1.32" />
  </Svg>
)

export default function LoginScreen() {
  const router = useRouter()
  const { login, loading, error, clearError } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  // Validation checks for login button activity state
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const isPasswordValid = password.length >= 8
  const isFormValid = isEmailValid && isPasswordValid

  const handleLogin = async () => {
    if (!isFormValid) return

    try {
      await login(email.trim(), password)
      router.replace('/(tabs)')
    } catch (err) {
      // Error is handled in Zustand store & shown via banner
    }
  }

  const handleSocialLogin = (provider: string) => {
    Alert.alert(
      'Informasi',
      `Fitur masuk dengan ${provider} akan segera hadir.`
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Brand */}
          <View style={styles.header}>
            <View style={styles.logoAndText}>
              {LOGO_S3_URL ? (
                <Image
                  source={{ uri: LOGO_S3_URL }}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              ) : (
                <Svg width={28} height={28} viewBox="0 0 100 100" fill="none">
                  <Path
                    d="M50 90C72.0914 90 90 72.0914 90 50C90 40 85 28 75 18C72 15 65 10 50 10V50V90Z"
                    fill="#22C55E"
                  />
                  <Path
                    d="M50 10C27.9086 10 10 27.9086 10 50C10 65 18 78 28 85C33 88 42 90 50 90V50V10Z"
                    fill="#0F172A"
                    opacity={0.9}
                  />
                  <Path
                    d="M50 10C50 10 47 40 47 50C47 60 50 90 50 90"
                    stroke="#FFFFFF"
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                </Svg>
              )}
              <Text style={styles.brandTitle}>Leafboard</Text>
            </View>
            <Text style={styles.subtitle}>Work without limits</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}

            {/* Email Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your email address</Text>
              <TextInput
                style={styles.input}
                placeholder="dierragip@gmail.com"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={(text) => {
                  clearError()
                  setEmail(text)
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!loading}
              />
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <View style={styles.passwordHeaderRow}>
                <Text style={styles.label}>Choose a password</Text>
              </View>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="min. 8 characters"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={(text) => {
                    clearError()
                    setPassword(text)
                  }}
                  secureTextEntry={!isPasswordVisible}
                  autoComplete="password"
                  editable={!loading}
                />
                <Pressable
                  style={styles.eyeBtn}
                  onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon
                    name="eye"
                    size={20}
                    color={isPasswordVisible ? '#0F1E36' : '#94A3B8'}
                  />
                </Pressable>
              </View>
            </View>

            {/* Submit Button */}
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                !isFormValid && styles.submitButtonDisabled,
                isFormValid && styles.submitButtonActive,
                pressed && isFormValid && styles.submitButtonPressed,
              ]}
              onPress={handleLogin}
              disabled={!isFormValid || loading}
            >
              {loading ? (
                <ActivityIndicator color="#0D2E16" size="small" />
              ) : (
                <>
                  <Text style={[styles.submitButtonText, isFormValid && styles.submitButtonTextActive]}>
                    Continue
                  </Text>
                  <Icon
                    name="angle-right"
                    size={14}
                    color={isFormValid ? '#0D2E16' : '#94A3B8'}
                    style={styles.btnIcon}
                  />
                </>
              )}
            </Pressable>
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Authentication */}
          <View style={styles.socialContainer}>
            <Pressable
              style={({ pressed }) => [styles.socialButton, pressed && styles.socialButtonPressed]}
              onPress={() => handleSocialLogin('Google')}
            >
              <GoogleIcon />
              <Text style={styles.socialButtonText}>Sign up with Google</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.socialButton, pressed && styles.socialButtonPressed]}
              onPress={() => handleSocialLogin('Apple')}
            >
              <AppleIcon />
              <Text style={styles.socialButtonText}>Sign up with Apple</Text>
            </Pressable>
          </View>

          {/* Footer Redirection */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            <Pressable onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.footerLink}>Sign up</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoAndText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xxs,
  },
  logoImage: {
    width: 32,
    height: 32,
  },
  brandTitle: {
    fontSize: 28,
    fontFamily: typography.font.sansBold,
    fontWeight: '700',
    color: '#0F1E36',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: typography.font.sansMedium,
    color: colors.muted,
  },
  formContainer: {
    gap: spacing.md,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.size.base,
    fontFamily: typography.font.sans,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: typography.font.sansSemiBold,
    fontWeight: '600',
    color: '#0F1E36',
    marginLeft: 4,
  },
  passwordHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: typography.font.sans,
    color: '#0F1E36',
    backgroundColor: '#FFFFFF',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: radius.lg,
    backgroundColor: '#FFFFFF',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: typography.font.sans,
    color: '#0F1E36',
  },
  eyeBtn: {
    paddingHorizontal: 14,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.lg,
    marginTop: spacing.xs,
    height: 54,
  },
  submitButtonDisabled: {
    backgroundColor: '#F1F5F9', // Screen 2: gray style
  },
  submitButtonActive: {
    backgroundColor: '#A3E635', // Screen 3: lime style
    shadowColor: '#A3E635',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonPressed: {
    backgroundColor: '#84CC16',
    transform: [{ scale: 0.99 }],
  },
  submitButtonText: {
    fontSize: 15,
    fontFamily: typography.font.sansSemiBold,
    fontWeight: '600',
    color: '#94A3B8',
  },
  submitButtonTextActive: {
    color: '#0D2E16',
  },
  btnIcon: {
    marginLeft: 6,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: spacing.md,
    fontSize: 14,
    fontFamily: typography.font.sans,
    color: '#94A3B8',
  },
  socialContainer: {
    gap: spacing.sm,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: radius.lg,
    paddingVertical: 14,
  },
  socialButtonPressed: {
    backgroundColor: '#F8FAFC',
  },
  socialIcon: {
    marginRight: spacing.sm,
  },
  socialButtonText: {
    fontSize: 14,
    fontFamily: typography.font.sansSemiBold,
    fontWeight: '600',
    color: '#0F1E36',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    fontSize: 14,
    fontFamily: typography.font.sans,
    color: colors.muted,
  },
  footerLink: {
    fontSize: 14,
    fontFamily: typography.font.sansSemiBold,
    fontWeight: '600',
    color: '#3b82f6',
  },
})
