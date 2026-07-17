# Dependency Reference — pjm-stock (BengkelLas)

> Expo SDK 54 — snapshot setelah dependency fix & compatibility patches.

---

## Expo SDK — 54.0.36

### Core
| Package | Versi | Keterangan |
|---|---|---|
| expo | ~54.0.36 | SDK utama |
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
| expo-build-properties | ~1.0.10 | compileSdk:35, minSdk:24, targetSdk:35, AGP:8.9.0, Gradle:8.14, Kotlin:2.1.20, newArch:true |

### Expo Packages
| Package | Versi |
|---|---|
| expo-camera | ~17.0.10 |
| expo-clipboard | ~8.0.8 |
| expo-constants | ~18.0.13 |
| expo-device | ~8.0.10 |
| expo-document-picker | ~14.0.0 |
| expo-file-system | ~19.0.23 |
| expo-font | ~14.0.12 |
| expo-haptics | ~15.0.8 |
| expo-image | ^3.0.11 |
| expo-image-picker | ~17.0.11 |
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
| react-native-gesture-handler | ~2.28.0 |
| react-native-reanimated | ^4.1.7 |
| react-native-safe-area-context | ~5.6.0 |
| react-native-screens | ~4.16.0 |
| react-native-svg | 15.12.1 |
| react-native-view-shot | 4.0.3 |
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
    "kotlinVersion": "2.1.20",
    "agpVersion": "8.9.0",
    "gradleVersion": "8.14",
    "newArchEnabled": true
  }
}
```

**babel.config.js** — dengan `unstable_transformProfile: 'hermes-v0'` untuk dukung Hermes 0.12:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', {
        unstable_transformProfile: 'hermes-v0',
      }],
    ],
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

## Patches (patch-package)

Patch diterapkan otomatis via `postinstall` script (`"postinstall": "patch-package"`).

| Package | Patch | Alasan |
|---|---|---|
| @react-native-community/art@1.2.0 | `prepareToRecycleView` override + remove `ArrayUtils` | RN 0.81.5 menghapus method & import yang tidak kompatibel |
| react-native-gesture-handler@2.28.0 | Hapus `getViewManagers()` | Interface `ViewManagerOnDemandReactPackage` di RN 0.81.5 hanya punya `getViewManagerNames` + `createViewManager` |
| react-native-reanimated@4.1.7 | Hapus duplikasi `GestureHandlerStateManager` | DEX merge conflict dengan gesture-handler |
