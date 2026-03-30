import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadows } from '../../styles/theme';

const ACTION_COLORS = { login: '#3b82f6', update_fuel: '#f59e0b', register: '#10b981', create: '#8b5cf6', delete: '#ef4444', update: '#06b6d4' };

export default function AuditCard({ item }) {
  const dt = item.created_at ? new Date(item.created_at).toLocaleString('th-TH') : '';
  return (
    <View style={s.card}>
      <View style={s.row}>
        <View style={[s.dot, { backgroundColor: ACTION_COLORS[item.action] || '#6b7280' }]} />
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{item.action}</Text>
          <Text style={s.sub}>{item.entity_type} {item.entity_name ? `· ${item.entity_name}` : ''}</Text>
          {item.details ? <Text style={s.meta}>{item.details}</Text> : null}
          <Text style={[s.meta, { marginTop: 2 }]}>👤 {item.user_name} ({item.user_type}) · {dt}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadows.soft },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm, marginTop: 4 },
  title: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  sub: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 1 },
  meta: { fontSize: 12, color: colors.outlineVariant, marginTop: 2 },
});
