import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows } from '../../styles/theme';

export default function StationCard({ item, onEdit, onDelete }) {
  return (
    <View style={s.card}>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{item.name}</Text>
          <Text style={s.sub}>{item.brand} · {item.province_name}</Text>
          <Text style={s.meta}>{item.address}</Text>
          {item.staff_count > 0 && <Text style={s.meta}>👤 {item.staff_count} พนักงาน</Text>}
        </View>
        <View style={s.actions}>
          <TouchableOpacity onPress={onEdit} style={s.iconBtn}>
            <Ionicons name="create-outline" size={18} color={colors.admin} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={s.iconBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.fuelEmpty} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadows.soft },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  sub: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 1 },
  meta: { fontSize: 12, color: colors.outlineVariant, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 4 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceLow, alignItems: 'center', justifyContent: 'center' },
});
