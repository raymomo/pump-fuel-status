import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadows } from '../../styles/theme';

export default function RequestCard({ item, onApprove, onReject }) {
  const isJoin = item.station_id != null && item.staff_name;
  const type = isJoin ? 'join-requests' : 'station-requests';
  const statusColor = item.status === 'pending' ? '#f59e0b' : item.status === 'approved' ? colors.fuelAvailable : colors.fuelEmpty;
  const statusText = item.status === 'pending' ? '⏳ รออนุมัติ' : item.status === 'approved' ? '✅ อนุมัติ' : '❌ ปฏิเสธ';

  return (
    <View style={s.card}>
      <View style={[s.tag, { backgroundColor: isJoin ? '#dbeafe' : '#fef3c7' }]}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: isJoin ? colors.primary : '#92400e' }}>
          {isJoin ? 'ขอเข้าร่วมปั๊ม' : 'ขอเพิ่มปั๊มใหม่'}
        </Text>
      </View>
      <Text style={s.title}>{isJoin ? item.staff_name : item.name}</Text>
      <Text style={s.sub}>{isJoin ? `ปั๊ม: ${item.station_name || item.station_id}` : `${item.brand} · ${item.province_name || ''}`}</Text>
      <View style={[s.status, { backgroundColor: statusColor + '20' }]}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: statusColor }}>{statusText}</Text>
      </View>
      {item.admin_note ? <Text style={s.meta}>📝 {item.admin_note}</Text> : null}
      {item.status === 'pending' && (
        <View style={s.actions}>
          <TouchableOpacity style={[s.btn, { backgroundColor: colors.fuelAvailable }]} onPress={() => onApprove(type, item.id)}>
            <Text style={s.btnText}>✓ อนุมัติ</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, { backgroundColor: colors.fuelEmpty }]} onPress={() => onReject(type, item.id)}>
            <Text style={s.btnText}>✗ ปฏิเสธ</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadows.soft },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.xl, marginBottom: 4 },
  title: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  sub: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 1 },
  meta: { fontSize: 12, color: colors.outlineVariant, marginTop: 4 },
  status: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.xl, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
  btn: { flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
