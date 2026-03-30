import { Text, StyleSheet } from 'react-native';
import { brandColors, radius } from '../styles/theme';

export default function BrandBadge({ brand }) {
  const bc = brandColors[brand] || brandColors.Other;
  return (
    <Text style={[styles.badge, { backgroundColor: bc.bg, color: bc.text }]}>
      {brand}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});
