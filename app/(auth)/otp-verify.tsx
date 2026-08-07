import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '@/stores/authStore'
import { colors, typography, radius, spacing } from '@/constants'
import { Icon } from '@/components/ui/Icon'
import Svg, { Path } from 'react-native-svg'
import { LOGO_S3_URL } from './welcome'   

const OTP_LENGTH = 6

export default function OtpVerifyScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ email?: string }>()
  const { pendingEmail, verifyOtp, resendOtp, loading, error, clearError } = useAuthStore()

  const targetEmail = params.email || pendingEmail || ''

  const [otp, setOtp] = useState('')
  const [timer, setTimer] = useState(30)
  const inputRef = useRef<TextInput>(null)

  // Countdown timer for resend button
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [timer])

  const handleOtpChange = (text: string) => {
    clearError()
    // Restrict input to digits only up to OTP_LENGTH
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH)
    setOtp(cleaned)
  }

  const handleVerify = async () => {
    if (otp.length < OTP_LENGTH) return

    try {
      await verifyOtp(targetEmail, otp)
      router.replace('/(tabs)')
    } catch (err) {
      // Error handled by store and displayed in banner
    }
  }

  const handleResend = async () => {
    if (timer > 0 || loading) return

    try {
      await resendOtp()
      setTimer(30)
      setOtp('')
    } catch (err) {
      // Error handled by store
    }
  }

  const renderOtpBoxes = () => {
    const digits = otp.split('')
    const boxes = []

    for (let i = 0; i < OTP_LENGTH; i++) {
      const digit = digits[i] || ''
      const isFocused = otp.length === i || (otp.length === OTP_LENGTH && i === OTP_LENGTH - 1)

      boxes.push(
        <View
          key={i}
          style={[
            styles.otpBox,
            digit ? styles.otpBoxFilled : null,
            isFocused ? styles.otpBoxFocused : null,
          ]}
        >
          <Text style={styles.otpDigitText}>{digit}</Text>
        </View>
      )
    }

    return boxes
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
          {/* Back button */}
          <Pressable
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="angle-left" size={20} color="#0F1E36" />
            <Text style={styles.backBtnText}>Kembali</Text>
          </Pressable>

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
              <Text style={styles.brandTitle}>Verifikasi Kode OTP</Text>
            </View>
            <Text style={styles.subtitle}>
              Kode verifikasi telah dikirimkan ke email (berlaku 5 menit):
            </Text>
            <Text style={styles.emailHighlight}>{targetEmail || 'email Anda'}</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}

            {/* OTP Input Boxes Container */}
            <Pressable
              style={styles.otpInputsRow}
              onPress={() => inputRef.current?.focus()}
            >
              {renderOtpBoxes()}
            </Pressable>

            {/* Hidden Input for smooth keyboard focus */}
            <TextInput
              ref={inputRef}
              style={styles.hiddenInput}
              value={otp}
              onChangeText={handleOtpChange}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              autoFocus
              editable={!loading}
            />

            {/* Submit Button */}
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                otp.length < OTP_LENGTH && styles.submitButtonDisabled,
                otp.length === OTP_LENGTH && styles.submitButtonActive,
                pressed && otp.length === OTP_LENGTH && styles.submitButtonPressed,
              ]}
              onPress={handleVerify}
              disabled={otp.length < OTP_LENGTH || loading}
            >
              {loading ? (
                <ActivityIndicator color="#0D2E16" size="small" />
              ) : (
                <>
                  <Text
                    style={[
                      styles.submitButtonText,
                      otp.length === OTP_LENGTH && styles.submitButtonTextActive,
                    ]}
                  >
                    Verifikasi Login
                  </Text>
                  <Icon
                    name="check"
                    size={16}
                    color={otp.length === OTP_LENGTH ? '#0D2E16' : '#94A3B8'}
                    style={styles.btnIcon}
                  />
                </>
              )}
            </Pressable>

            {/* Resend Section */}
            <View style={styles.resendRow}>
              <Text style={styles.resendText}>Tidak menerima kode? </Text>
              <Pressable
                onPress={handleResend}
                disabled={timer > 0 || loading}
              >
                <Text
                  style={[
                    styles.resendLink,
                    (timer > 0 || loading) && styles.resendLinkDisabled,
                  ]}
                >
                  {timer > 0 ? `Kirim ulang (${timer}s)` : 'Kirim Ulang Kode'}
                </Text>
              </Pressable>
            </View>
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
    paddingVertical: spacing.xl,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backBtnText: {
    fontSize: 14,
    fontFamily: typography.font.sansMedium,
    color: '#0F1E36',
    marginLeft: 4,
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
    fontSize: 24,
    fontFamily: typography.font.sansBold,
    fontWeight: '700',
    color: '#0F1E36',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: typography.font.sans,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
  },
  emailHighlight: {
    fontSize: 14,
    fontFamily: typography.font.sansSemiBold,
    fontWeight: '600',
    color: '#0F1E36',
    marginTop: 2,
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
  otpInputsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.md,
  },
  otpBox: {
    width: 46,
    height: 52,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  otpBoxFilled: {
    borderColor: '#0F1E36',
    backgroundColor: '#FFFFFF',
  },
  otpBoxFocused: {
    borderColor: '#A3E635',
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  otpDigitText: {
    fontSize: 20,
    fontFamily: typography.font.sansBold,
    fontWeight: '700',
    color: '#0F1E36',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
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
    backgroundColor: '#F1F5F9',
  },
  submitButtonActive: {
    backgroundColor: '#A3E635',
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
    marginLeft: 8,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  resendText: {
    fontSize: 14,
    fontFamily: typography.font.sans,
    color: colors.muted,
  },
  resendLink: {
    fontSize: 14,
    fontFamily: typography.font.sansSemiBold,
    fontWeight: '600',
    color: '#3b82f6',
  },
  resendLinkDisabled: {
    color: '#94A3B8',
  },
})
