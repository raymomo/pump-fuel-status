import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../styles/theme';

const FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'available', label: '🟢 มีน้ำมัน' },
  { key: 'empty', label: '🔴 หมด' },
];

export default function FilterBar({ value, onChange, counts }) {
  return (
    <View style={styles.container}>
      {FILTERS.map(f => (
        <TouchableOpacity
          key={f.key}
          style={[styles.btn, value === f.key && styles.btnActive]}
          onPress={() => onChange(f.key)}
        >
          <Text style={[styles.text, value === f.key && styles.textActive]}>
            {f.label} ({counts[f.key] || 0})
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.surfaceLow },
  btn: { flex: 1, paddingVertical: 6, borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(193,198,215,0.15)', backgroundColor: colors.surfaceLowest, alignItems: 'center' },
  btnActive: { backgroundColor: '#e8f0fe', borderColor: colors.primary },
  text: { fontSize: 11, color: colors.onSurfaceVariant, fontWeight: '500' },
  textActive: { color: colors.primary, fontWeight: '600' },
});
