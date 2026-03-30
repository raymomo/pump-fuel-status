import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadows } from '../../styles/theme';

export default function BrandCard({ item, onEdit, onDelete }) {
  return (
    <View style={s.card}>
      <View style={s.row}>
        {item.logo_url ? (
          <Image source={{ uri: item.logo_url }} style={s.logo} resizeMode="contain" />
        ) : (
          <View style={[s.logoPlaceholder, item.color && { backgroundColor: item.color + '20' }]}>
            <Text style={[s.logoText, item.color && { color: item.color }]}>{item.name?.charAt(0)}</Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={s.name}>{item.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {item.color && <View style={[s.colorDot, { backgroundColor: item.color }]} />}
            <Text style={s.meta}>ลำดับ: {item.sort_order || 0}</Text>
          </View>
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
  logo: { width: 44, height: 44, borderRadius: radius.md },
  logoPlaceholder: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceLow, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 20, fontWeight: '800', color: colors.onSurfaceVariant },
  name: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  colorDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  meta: { fontSize: 12, color: colors.outlineVariant },
  actions: { flexDirection: 'row', gap: 4 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceLow, alignItems: 'center', justifyContent: 'center' },
});
