import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getOverview, getRecentUpdates } from '../utils/api';
import { timeAgo } from '../utils/helpers';
import { colors, spacing, radius, shadows } from '../styles/theme';

export default function OverviewScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const [overview, updates] = await Promise.all([getOverview(), getRecentUpdates()]);
    setData(overview);
    setRecent(updates);
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!data) return <View style={styles.center}><Text style={styles.loading}>กำลังโหลด...</Text></View>;

  const { summary, provinces } = data;
  const sorted = [...provinces].filter(p => p.total_stations > 0).sort((a, b) => a.fuel_availability_pct - b.fuel_availability_pct);
  const pctColor = (pct) => pct >= 60 ? colors.fuelAvailable : pct >= 30 ? '#f59e0b' : colors.fuelEmpty;

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}>

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.pctCircleWrap}>
          <View style={[styles.pctCircle, { borderColor: pctColor(summary.fuel_availability_pct) }]}>
            <Text style={[styles.pctNum, { color: pctColor(summary.fuel_availability_pct) }]}>{summary.fuel_availability_pct}%</Text>
            <Text style={styles.pctLabel}>น้ำมันคงเหลือ</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="business" size={20} color={colors.primary} />
            <Text style={styles.statNum}>{summary.total_stations}</Text>
            <Text style={styles.statLabel}>ปั๊มทั้งหมด</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.fuelAvailableBg }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.fuelAvailable} />
            <Text style={[styles.statNum, { color: colors.fuelAvailable }]}>{summary.stations_with_fuel}</Text>
            <Text style={styles.statLabel}>มีน้ำมัน</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.fuelEmptyBg }]}>
            <Ionicons name="close-circle" size={20} color={colors.fuelEmpty} />
            <Text style={[styles.statNum, { color: colors.fuelEmpty }]}>{summary.stations_no_fuel}</Text>
            <Text style={styles.statLabel}>ไม่มี</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="water" size={20} color={colors.primary} />
            <Text style={styles.statNum}>{summary.available_fuels}/{summary.available_fuels + summary.unavailable_fuels}</Text>
            <Text style={styles.statLabel}>หัวจ่ายที่เปิด</Text>
          </View>
        </View>
      </View>

      {/* Recent Updates */}
      {recent.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🕐 อัปเดตล่าสุด</Text>
          {recent.slice(0, 5).map((r, i) => (
            <TouchableOpacity key={i} style={styles.recentItem} onPress={() => navigation.navigate('StationDetail', { id: r.station_id })} activeOpacity={0.7}>
              <View style={[styles.recentDot, { backgroundColor: r.is_available ? colors.fuelAvailable : colors.fuelEmpty }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.recentName} numberOfLines={1}>{r.station_name}</Text>
                <Text style={styles.recentSub}>{r.fuel_type} · {r.is_available ? 'มีน้ำมัน' : 'หมด'} {r.remaining_cars != null ? `· ~${r.remaining_cars} คัน` : ''}</Text>
                <Text style={styles.recentTime}>{r.updated_by} · {timeAgo(r.updated_at)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Province breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 สถานะรายจังหวัด</Text>
        {sorted.map(p => (
          <View key={p.province_id} style={styles.provinceRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.provinceName}>{p.province_name}</Text>
              <Text style={styles.provinceSub}>{p.total_stations} ปั๊ม · มี {p.stations_with_fuel} / ไม่มี {p.stations_no_fuel}</Text>
            </View>
            <View style={styles.provinceRight}>
              <View style={styles.barWrap}>
                <View style={[styles.barFill, { width: `${p.fuel_availability_pct}%`, backgroundColor: pctColor(p.fuel_availability_pct) }]} />
              </View>
              <Text style={[styles.provincePct, { color: pctColor(p.fuel_availability_pct) }]}>{p.fuel_availability_pct}%</Text>
            </View>
          </View>
        ))}

        {provinces.filter(p => p.total_stations === 0).map(p => (
          <View key={p.province_id} style={[styles.provinceRow, { opacity: 0.4 }]}>
            <Text style={styles.provinceName}>{p.province_name}</Text>
            <Text style={styles.provinceSub}>ยังไม่มีปั๊มในระบบ</Text>
          </View>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { fontSize: 16, color: colors.onSurfaceVariant },

  hero: { backgroundColor: '#fff', padding: spacing.xl, alignItems: 'center', ...shadows.soft },
  pctCircleWrap: { marginBottom: spacing.lg },
  pctCircle: { width: 130, height: 130, borderRadius: 65, borderWidth: 6, alignItems: 'center', justifyContent: 'center' },
  pctNum: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  pctLabel: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%' },
  statCard: { width: '47%', backgroundColor: colors.surfaceLow, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', ...shadows.soft },
  statNum: { fontSize: 20, fontWeight: '800', color: colors.onSurface, marginTop: 4 },
  statLabel: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },

  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.md },

  recentItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: '#fff', borderRadius: radius.md, marginBottom: spacing.sm, ...shadows.soft },
  recentDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.md },
  recentName: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  recentSub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 1 },
  recentTime: { fontSize: 11, color: colors.outlineVariant, marginTop: 1 },

  provinceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: '#fff', borderRadius: radius.lg, marginBottom: spacing.sm, ...shadows.soft },
  provinceName: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  provinceSub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
  provinceRight: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 120 },
  barWrap: { flex: 1, height: 6, backgroundColor: colors.surfaceLow, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  provincePct: { fontSize: 14, fontWeight: '700', width: 40, textAlign: 'right' },
});
