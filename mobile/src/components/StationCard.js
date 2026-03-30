import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, shadows, spacing } from '../styles/theme';
import { brandColors } from '../styles/theme';
import FuelTag from './FuelTag';
import { timeAgo } from '../utils/helpers';

export default function StationCard({ station, onPress, distance }) {
  const brand = brandColors[station.brand] || brandColors.Other;
  const latestUpdate = station.fuels?.filter(f => f.updated_at).map(f => new Date(f.updated_at).getTime());
  const latest = latestUpdate?.length > 0 ? Math.max(...latestUpdate) : 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.topRow}>
            <Text style={styles.province}>{station.province_name}</Text>
            {distance != null && (
              <Text style={styles.distance}>{distance.toFixed(1)} กม.</Text>
            )}
          </View>
          <Text style={styles.name} numberOfLines={1}>{station.name}</Text>
        </View>
        <Text style={[styles.brand, { backgroundColor: brand.bg, color: brand.text }]}>{station.brand}</Text>
      </View>

      <Text style={styles.address} numberOfLines={1}>{station.address}</Text>

      <View style={styles.fuelTags}>
        {station.fuels?.map(f => <FuelTag key={f.fuel_type} fuel={f} />)}
      </View>

      {latest > 0 && (
        <Text style={styles.updateTime}>🕐 {timeAgo(latest)}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    ...shadows.ambient,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  province: { fontSize: 11, color: colors.primary, backgroundColor: '#e8f0fe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, fontWeight: '600', overflow: 'hidden' },
  distance: { fontSize: 11, color: colors.onSurfaceVariant, fontWeight: '500' },
  name: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  brand: { fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.md, fontWeight: '700', overflow: 'hidden' },
  address: { fontSize: 12, color: colors.onSurfaceVariant, marginBottom: spacing.sm },
  fuelTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  updateTime: { fontSize: 10, color: colors.outlineVariant, marginTop: spacing.sm },
});
