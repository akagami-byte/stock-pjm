# Dependency Reference — pjm-stock (BengkelLas)

> Snapshot: commit `15dfbea` — Expo SDK 54
> Dibuat sebelum upgrade ke SDK 57 untuk rollback reference.

---

## Expo SDK — 54.0.35

### Core
| Package | Versi | Keterangan |
|---|---|---|
| expo | ~54.0.35 | SDK utama |
| expo-router | ~6.0.24 | File-based routing |
| react | 19.1.0 | — |
| react-dom | 19.1.0 | — |
| react-native | 0.81.5 | — |
| react-native-web | ~0.21.0 | Web target |

### Expo Plugins (app.json)
| Plugin | Versi | Konfigurasi |
|---|---|---|
| expo-router | bundled | — |
| expo-splash-screen | ~31.0.13 | bg:#0F172A |
| expo-camera | ~17.0.10 | cameraPermission |
| expo-sqlite | ~16.0.10 | — |
| expo-document-picker | ~14.0.0 | — |
| expo-build-properties | ~0.14.0 | compileSdk:35, minSdk:24, targetSdk:35, AGP:8.7.3, Gradle:8.9, Kotlin:2.0.21, newArch:true |

### Expo Packages
| Package | Versi |
|---|---|
| expo-camera | ~17.0.10 |
| expo-clipboard | ~8.0.8 |
| expo-constants | ~18.0.13 |
| expo-device | ^5.9.4 |
| expo-document-picker | ~14.0.0 |
| expo-file-system | ~19.0.23 |
| expo-font | ~14.0.12 |
| expo-haptics | ~15.0.8 |
| expo-image | ^3.0.11 |
| expo-image-picker | ~16.0.0 |
| expo-linking | ~8.0.12 |
| expo-network | ~8.0.8 |
| expo-print | ~15.0.0 |
| expo-sharing | ~14.0.8 |
| expo-splash-screen | ~31.0.13 |
| expo-sqlite | ~16.0.10 |
| expo-status-bar | ~3.0.9 |
| expo-symbols | ^1.0.8 |
| expo-web-browser | ~15.0.11 |

### React Native Libraries
| Package | Versi |
|---|---|
| react-native-gesture-handler | ~2.20.0 |
| react-native-reanimated | ~4.1.1 |
| react-native-safe-area-context | ~5.6.0 |
| react-native-screens | ~4.16.0 |
| react-native-svg | ^15.15.5 |
| react-native-view-shot | ^5.1.1 |
| react-native-barcode-builder | ^2.0.0 |
| react-native-chart-kit | ^7.0.1 |
| react-native-qrcode-svg | ^6.3.21 |
| react-native-worklets | 0.5.1 |

### Fonts & Data
| Package | Versi |
|---|---|
| @expo-google-fonts/inter | ^0.4.2 |
| @expo-google-fonts/jetbrains-mono | ^0.4.1 |
| @supabase/supabase-js | ^2.110.1 |
| zustand | ^5.0.14 |
| jsbarcode | ^3.12.3 |
| qrcode | ^1.5.4 |
| crypto-js | ^4.2.0 |
| react-native-qrcode-svg | ^6.3.21 |

### Polyfills
| Package | Versi |
|---|---|
| buffer | ^6.0.3 |
| crypto-browserify | ^3.12.1 |
| readable-stream | ^4.7.0 |

### Dev Dependencies
| Package | Versi |
|---|---|
| @types/crypto-js | ^4.2.2 |
| @types/react | ~19.1.0 |
| eslint | ^9.0.0 |
| eslint-config-expo | ~10.0.0 |
| typescript | ~5.9.2 |

### Build Config Files
**app.json** — plugin `expo-build-properties`:
```json
{
  "android": {
    "compileSdkVersion": 35,
    "targetSdkVersion": 35,
    "buildToolsVersion": "35.0.0",
    "minSdkVersion": 24,
    "kotlinVersion": "2.0.21",
    "agpVersion": "8.7.3",
    "gradleVersion": "8.9",
    "newArchEnabled": true
  }
}
```

**babel.config.js**:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

**metro.config.js**:
```js
const { getDefaultConfig } = require('expo/metro-config')
const config = getDefaultConfig(__dirname)
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: require.resolve('buffer/'),
}
module.exports = config
```

---

> Cara rollback: `git checkout main && git branch -D upgrade-sdk57`
