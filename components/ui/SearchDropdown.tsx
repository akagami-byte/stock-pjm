import { useState, useEffect, useCallback } from 'react'
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator } from 'react-native'
import { colors, typography, radius } from '@/constants'

interface SearchDropdownItem {
  id: string
  label: string
  subtitle?: string
}

interface SearchDropdownProps {
  label?: string
  placeholder?: string
  items: SearchDropdownItem[]
  value?: string
  onSelect: (item: SearchDropdownItem) => void
  onSearch?: (query: string) => void
  loading?: boolean
  error?: string | null
  disabled?: boolean
  emptyMessage?: string
}

export default function SearchDropdown({
  label, placeholder = 'Cari...', items, value = '',
  onSelect, onSearch, loading = false, error,
  disabled = false, emptyMessage = 'Tidak ada data',
}: SearchDropdownProps) {
  const [query, setQuery] = useState(value)
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => { if (value !== query) setQuery(value) }, [value])

  const handleChange = useCallback((text: string) => {
    setQuery(text)
    onSearch?.(text)
    setShowDropdown(true)
  }, [onSearch])

  return (
    <View style={{ gap: 6 }}>
      {label && (
        <Text style={{ fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.muted, marginLeft: 4 }}>
          {label}
        </Text>
      )}
      <View>
        <TextInput
          style={{
            borderWidth: 1, borderColor: error ? colors.error : colors.hairline,
            borderRadius: radius.md, padding: 12, paddingRight: 44,
            fontSize: typography.size.base, color: colors.ink,
            backgroundColor: colors.canvas, opacity: disabled ? 0.5 : 1,
          }}
          value={query}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedSoft}
          onFocus={() => setShowDropdown(true)}
          editable={!disabled}
        />
        {loading && (
          <ActivityIndicator style={{ position: 'absolute', right: 14, top: 14 }} color={colors.brand} size="small" />
        )}
      </View>
      {error && <Text style={{ fontSize: typography.size.xs, color: colors.error, marginLeft: 4 }}>{error}</Text>}

      {showDropdown && items.length > 0 && (
        <View style={{ backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.md, maxHeight: 200, marginTop: 4, overflow: 'hidden' }}>
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            nestedScrollEnabled
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft },
                  pressed && { backgroundColor: colors.surfaceCard },
                ]}
                onPress={() => { setQuery(item.label); setShowDropdown(false); onSelect(item) }}
              >
                <Text style={{ fontSize: typography.size.base, color: colors.ink, fontWeight: typography.weight.medium }}>
                  {item.label}
                </Text>
                {item.subtitle && (
                  <Text style={{ fontSize: typography.size.sm, color: colors.muted, marginTop: 2 }}>
                    {item.subtitle}
                  </Text>
                )}
              </Pressable>
            )}
          />
        </View>
      )}

      {showDropdown && !loading && items.length === 0 && query.length > 0 && (
        <View style={{ backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.md, padding: 12, marginTop: 4 }}>
          <Text style={{ fontSize: typography.size.sm, color: colors.muted, textAlign: 'center' }}>{emptyMessage}</Text>
        </View>
      )}
    </View>
  )
}
