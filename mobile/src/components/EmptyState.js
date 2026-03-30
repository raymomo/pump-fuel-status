import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../styles/theme';

export default function EmptyState({ icon = '📭', title, subtitle }) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 40 },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '600', color: colors.onSurface },
  subtitle: { fontSize: 14, color: colors.onSurfaceVariant, marginTop: 4, textAlign: 'center' },
});
