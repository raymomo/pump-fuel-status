import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows } from '../../styles/theme';

export default function AdminCard({ item, onDelete }) {
  return (
    <View style={s.card}>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>🛡️ {item.name || item.username}</Text>
          <Text style={s.sub}>@{item.username}</Text>
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
  sub: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 1 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceLow, alignItems: 'center', justifyContent: 'center' },
});
