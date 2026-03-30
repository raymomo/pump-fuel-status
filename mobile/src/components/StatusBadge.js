import { Text, StyleSheet } from 'react-native';
import { colors, radius } from '../styles/theme';

export default function StatusBadge({ available }) {
  return (
    <Text style={[styles.badge, available ? styles.ok : styles.no]}>
      {available ? '● มีน้ำมัน' : '● หมด'}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: { fontSize: 12, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.xl, overflow: 'hidden' },
  ok: { backgroundColor: colors.fuelAvailableBg, color: colors.fuelAvailable },
  no: { backgroundColor: colors.fuelEmptyBg, color: colors.fuelEmpty },
});
