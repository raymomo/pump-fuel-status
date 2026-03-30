import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, shadows, spacing } from '../styles/theme';

const RADII = [0, 5, 10, 20, 50];

export default function RadiusBar({ value, onChange, greenCount, redCount }) {
  return (
    <View style={styles.container}>
      <View style={styles.options}>
        {RADII.map(r => (
          <TouchableOpacity
            key={r}
            style={[styles.opt, value === r && styles.optActive]}
            onPress={() => onChange(r)}
          >
            <Text style={[styles.optText, value === r && styles.optTextActive]}>
              {r === 0 ? 'ทั้งหมด' : `${r}กม.`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.info}>
        <Text style={{ color: colors.fuelAvailable }}>🟢{greenCount}</Text>
        {' '}
        <Text style={{ color: colors.fuelEmpty }}>🔴{redCount}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceLowest,
  },
  options: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceLow,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  opt: { paddingHorizontal: 12, paddingVertical: 8 },
  optActive: { backgroundColor: colors.primary },
  optText: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant },
  optTextActive: { color: colors.onPrimary },
  info: { fontSize: 12, fontWeight: '700' },
});
