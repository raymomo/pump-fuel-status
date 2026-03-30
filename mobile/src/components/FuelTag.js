import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../styles/theme';

export default function FuelTag({ fuel }) {
  const ok = fuel.is_available;
  return (
    <View style={[styles.tag, ok ? styles.tagOk : styles.tagNo]}>
      <Text style={[styles.text, ok ? styles.textOk : styles.textNo]}>
        {ok ? '✓' : '✗'} {fuel.fuel_type}
        {ok && fuel.remaining_cars != null ? ` ~${fuel.remaining_cars}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.xl },
  tagOk: { backgroundColor: colors.fuelAvailableBg },
  tagNo: { backgroundColor: colors.fuelEmptyBg },
  text: { fontSize: 11, fontWeight: '500' },
  textOk: { color: colors.fuelAvailable },
  textNo: { color: colors.fuelEmpty, textDecorationLine: 'line-through' },
});
