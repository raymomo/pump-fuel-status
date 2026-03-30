import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows } from '../../styles/theme';

export default function FuelTypeCard({ item, onDelete }) {
  return (
    <View style={s.card}>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>⛽ {item.name}</Text>
          <Text style={s.meta}>ลำดับ: {item.sort_order || 0}</Text>
        </View>
        <TouchableOpacity onPress={onDelete} style={s.iconBtn}>
          <Ionicons name="trash-outline" size={18} color={colors.fuelEmpty} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadows.soft },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  meta: { fontSize: 12, color: colors.outlineVariant, marginTop: 2 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceLow, alignItems: 'center', justifyContent: 'center' },
});
