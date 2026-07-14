// components/ui/Icon.tsx
// Icon component — inline SVG via react-native-svg (no font dependency)
import React from 'react'
import { View } from 'react-native'
import Svg, { Path, G, Rect, Circle } from 'react-native-svg'

export type IconName =
  | 'camera' | 'search' | 'plus' | 'check' | 'check-circle'
  | 'cross' | 'cross-circle' | 'trash' | 'edit' | 'print'
  | 'arrow-left' | 'arrow-right' | 'download' | 'upload' | 'share'
  | 'save' | 'folder' | 'box' | 'refresh'
  | 'settings' | 'user' | 'home' | 'list' | 'info'
  | 'warning' | 'star' | 'lock' | 'eye' | 'copy'
  | 'scan' | 'barcode' | 'history' | 'clock' | 'calendar'
  | 'filter' | 'sort' | 'more' | 'menu' | 'close'
  | 'back' | 'building' | 'phone' | 'map-marker'
  | 'angle-left' | 'angle-right' | 'angle-down'
  | 'document' | 'pdf-file' | 'cart' | 'store' | 'industry'
  | 'package'

interface IconProps {
  name: IconName
  size?: number
  color?: string
  style?: any
}

// SVG paths extracted from uicons-regular-rounded SVGs
const PATHS: Record<string, { viewBox: string; d: string[] }> = {
  camera:     { viewBox: '0 0 24 24', d: ['M12 16.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z','M3 8c0-1.1.9-2 2-2h1.17a2 2 0 001.72-1.03L8.5 4h7l.61 1.97A2 2 0 0017.83 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z']},
  search:     { viewBox: '0 0 24 24', d: ['M10 18a8 8 0 100-16 8 8 0 000 16z','M22 22l-4.35-4.35']},
  plus:       { viewBox: '0 0 24 24', d: ['M12 5v14M5 12h14']},
  check:      { viewBox: '0 0 24 24', d: ['M5 13l4 4L19 7']},
  'check-circle': { viewBox: '0 0 24 24', d: ['M12 2a10 10 0 100 20 10 10 0 000-20z','M8 12l3 3 5-5']},
  cross:      { viewBox: '0 0 24 24', d: ['M6 6l12 12M18 6L6 18']},
  'cross-circle': { viewBox: '0 0 24 24', d: ['M12 2a10 10 0 100 20 10 10 0 000-20z','M9 9l6 6M15 9l-6 6']},
  trash:      { viewBox: '0 0 24 24', d: ['M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-.87 12.14A2 2 0 0116.14 20H7.86a2 2 0 01-1.99-1.86L5 6']},
  edit:       { viewBox: '0 0 24 24', d: ['M17 3a2.83 2.83 0 114 4L7.5 20.5 3 22l1.5-4.5L17 3z']},
  print:      { viewBox: '0 0 24 24', d: ['M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2','M6 14h12v8H6z']},
  'arrow-left': { viewBox: '0 0 24 24', d: ['M19 12H5M12 19l-7-7 7-7']},
  'arrow-right': { viewBox: '0 0 24 24', d: ['M5 12h14M12 5l7 7-7 7']},
  download:   { viewBox: '0 0 24 24', d: ['M12 3v12M8 11l4 4 4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2']},
  upload:     { viewBox: '0 0 24 24', d: ['M12 15V3M8 7l4-4 4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2']},
  share:      { viewBox: '0 0 24 24', d: ['M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6zM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98']},
  save:       { viewBox: '0 0 24 24', d: ['M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z','M8 3v4h8V3M8 21v-6h8v6']},
  folder:     { viewBox: '0 0 24 24', d: ['M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6.47a1 1 0 01-.86-.49L10.6 4.49A1 1 0 009.74 4H5a2 2 0 00-2 2v1z']},
  box:        { viewBox: '0 0 24 24', d: ['M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z','M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12']},
  package:    { viewBox: '0 0 24 24', d: ['M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z','M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12']},
  refresh:    { viewBox: '0 0 24 24', d: ['M23 4v6h-6M1 20v-6h6','M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15']},
  settings:   { viewBox: '0 0 24 24', d: ['M12 15a3 3 0 100-6 3 3 0 000 6z','M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z']},
  user:       { viewBox: '0 0 24 24', d: ['M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z']},
  home:       { viewBox: '0 0 24 24', d: ['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10']},
  list:       { viewBox: '0 0 24 24', d: ['M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01']},
  info:       { viewBox: '0 0 24 24', d: ['M12 2a10 10 0 100 20 10 10 0 000-20zM12 16v-4M12 8h.01']},
  warning:    { viewBox: '0 0 24 24', d: ['M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01']},
  star:       { viewBox: '0 0 24 24', d: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z']},
  lock:       { viewBox: '0 0 24 24', d: ['M7 11V7a5 5 0 0110 0v4M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2zM12 15v3']},
  eye:        { viewBox: '0 0 24 24', d: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 100-6 3 3 0 000 6z']},
  copy:       { viewBox: '0 0 24 24', d: ['M8 4v12a2 2 0 002 2h8a2 2 0 002-2V7.24a1 1 0 00-.29-.7l-4.24-4.25A1 1 0 0014.76 2H10a2 2 0 00-2 2zM16 2v5h5M4 8v12a2 2 0 002 2h8']},
  scan:       { viewBox: '0 0 24 24', d: ['M3 7V5a2 2 0 012-2h2M15 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 12h10']},
  barcode:    { viewBox: '0 0 24 24', d: ['M4 7v-1a2 2 0 012-2h2M4 17v1a2 2 0 002 2h2M16 4h2a2 2 0 012 2v1M16 20h2a2 2 0 002-2v-1M5 10v4M9 8v8M13 8v8M16 10v4M10 8v8']},
  history:    { viewBox: '0 0 24 24', d: ['M12 8v4l3 3M22 12a10 10 0 11-20 0 10 10 0 0120 0zM1 4v4h4']},
  clock:      { viewBox: '0 0 24 24', d: ['M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2']},
  calendar:   { viewBox: '0 0 24 24', d: ['M3 6v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2zM16 2v4M8 2v4M3 10h18']},
  filter:     { viewBox: '0 0 24 24', d: ['M22 3H2l8 9.46V19l4 2v-8.54L22 3z']},
  sort:       { viewBox: '0 0 24 24', d: ['M8 6h13M8 12h9M8 18h5M3 6h.01M3 12h.01M3 18h.01']},
  more:       { viewBox: '0 0 24 24', d: ['M12 13a1 1 0 100-2 1 1 0 000 2zM19 13a1 1 0 100-2 1 1 0 000 2zM5 13a1 1 0 100-2 1 1 0 000 2z']},
  menu:       { viewBox: '0 0 24 24', d: ['M3 12h18M3 6h18M3 18h18']},
  close:      { viewBox: '0 0 24 24', d: ['M18 6L6 18M6 6l12 12']},
  back:       { viewBox: '0 0 24 24', d: ['M19 12H5M12 19l-7-7 7-7']},
  building:   { viewBox: '0 0 24 24', d: ['M3 21h18M3 7v14M7 10h4M7 14h2M13 10h4M15 14h2M9 3v4M15 3v4M7 3h10l4 4H3l4-4z']},
  phone:      { viewBox: '0 0 24 24', d: ['M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z']},
  'map-marker': { viewBox: '0 0 24 24', d: ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0zM12 13a3 3 0 100-6 3 3 0 000 6z']},
  'angle-left': { viewBox: '0 0 24 24', d: ['M15 18l-6-6 6-6']},
  'angle-right': { viewBox: '0 0 24 24', d: ['M9 18l6-6-6-6']},
  'angle-down': { viewBox: '0 0 24 24', d: ['M6 9l6 6 6-6']},
  document:   { viewBox: '0 0 24 24', d: ['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8']},
  'pdf-file': { viewBox: '0 0 24 24', d: ['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h4']},
  cart:       { viewBox: '0 0 24 24', d: ['M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0']},
  store:      { viewBox: '0 0 24 24', d: ['M3 9l1.5-5h15L21 9M3 9v10a2 2 0 002 2h14a2 2 0 002-2V9M3 9h18M12 11v10M9 21v-6a3 3 0 016 0v6']},
  industry:   { viewBox: '0 0 24 24', d: ['M2 20V9l8-5v4l6-3.5V20M2 20h20M4 13h4M4 17h2M14 10h4M14 15h4']},
}

export function Icon({ name, size = 20, color = '#111', style }: IconProps) {
  const icon = PATHS[name]
  if (!icon) return null

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox={icon.viewBox} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {icon.d.map((path, i) => (
          <Path key={i} d={path} />
        ))}
      </Svg>
    </View>
  )
}
