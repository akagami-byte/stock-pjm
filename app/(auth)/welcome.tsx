import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, typography, radius, spacing } from '@/constants'
import { Icon } from '@/components/ui/Icon'
import Svg, { Path } from 'react-native-svg'

const { width } = Dimensions.get('window')

// ==========================================
// 💡 TARUH LINK LOGO S3 ANDA DI SINI
// ==========================================
export const LOGO_S3_URL = 'https://is3.cloudhost.id/pjm-mobile-storage/other/PJM Logo.png' // Kosongkan untuk menggunakan fallback logo SVG Leafboard

export default function WelcomeScreen() {
  const router = useRouter()

  const handleGetStarted = () => {
    router.push('/(auth)/register')
  }

  return (
    <View style={styles.container}>
      {/* Dark curved header section */}
      <View style={styles.header}>
        {/* Subtle background decoration (dotted/circles pattern mockup) */}
        <View style={styles.ambientCircle1} />
        <View style={styles.ambientCircle2} />

        {/* Logo container positioned at the bottom of the curvature */}
        <View style={styles.logoBadge}>
          {LOGO_S3_URL ? (
            <Image
              source={{ uri: LOGO_S3_URL }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          ) : (
            // Fallback: Leafboard Premium SVG Logo
            <Svg width={46} height={46} viewBox="0 0 100 100" fill="none">
              <Path
                d="M50 90C72.0914 90 90 72.0914 90 50C90 40 85 28 75 18C72 15 65 10 50 10V50V90Z"
                fill="#22C55E" // Light green side of page logo
              />
              <Path
                d="M50 10C27.9086 10 10 27.9086 10 50C10 65 18 78 28 85C33 88 42 90 50 90V50V10Z"
                fill="#0F172A" // Dark black/slate side of page logo
                opacity={0.9}
              />
              {/* White center line vein */}
              <Path
                d="M50 10C50 10 47 40 47 50C47 60 50 90 50 90"
                stroke="#FFFFFF"
                strokeWidth={3}
                strokeLinecap="round"
              />
            </Svg>
          )}
        </View>
      </View>

      {/* Content section */}
      <SafeAreaView style={styles.contentContainer} edges={['bottom']}>
        <View style={styles.textContent}>
          <Text style={styles.title}>Leafboard</Text>
          <Text style={styles.subtitle}>
            Satu platform untuk manajemen stok 
          </Text>
        </View>

        {/* Action Button */}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleGetStarted}
        >
          <Text style={styles.buttonText}>Mulai</Text>
          <Icon name="angle-right" size={14} color="#0D2E16" style={styles.buttonIcon} />
        </Pressable>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    width: '100%',
    height: '48%',
    backgroundColor: '#0F1E36', // Premium Slate Dark Blue
    borderBottomLeftRadius: 180,
    borderBottomRightRadius: 180,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  ambientCircle1: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    top: -50,
    left: -50,
  },
  ambientCircle2: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    bottom: 20,
    right: -80,
  },
  logoBadge: {
    width: 106,
    height: 106,
    borderRadius: 53,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    bottom: -53, // Centered on the boundary curve
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  logoImage: {
    width: 70,
    height: 70,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 80, // Offset for the hanging logo badge
    paddingBottom: spacing.xl,
  },
  textContent: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  title: {
    fontSize: 42,
    fontFamily: typography.font.sansBold,
    fontWeight: '700',
    color: '#0F1E36', // Matching dark blue brand
    letterSpacing: -0.8,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: typography.font.sansMedium,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#A3E635', // Premium Bright Lime Green
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A3E635',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    width: '100%',
    maxHeight: 60,
  },
  buttonPressed: {
    backgroundColor: '#84CC16', // Darker lime on press
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: '#0D2E16', // Deep dark green text for readability
    fontSize: 16,
    fontFamily: typography.font.sansSemiBold,
    fontWeight: '600',
  },
  buttonIcon: {
    marginLeft: spacing.xs,
  },
})
