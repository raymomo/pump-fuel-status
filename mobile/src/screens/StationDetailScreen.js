import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Linking, Share, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { DOMAIN, getStation, adminGet, getProvinces, getStationReports } from '../utils/api';
import { storage } from '../utils/storage';
import StationFormModal from './admin/StationFormModal';
import { timeAgo } from '../utils/helpers';
import socket from '../utils/socket';
import { colors, spacing, radius, shadows } from '../styles/theme';

export default function StationDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const [station, setStation] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [staffSession, setStaffSession] = useState(null);
  const [adminSession, setAdminSession] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [provinces, setProvinces] = useState([]);
  const [fuelTypes, setFuelTypes] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [brandsList, setBrandsList] = useState([]);
  const [publicReports, setPublicReports] = useState([]);

  const load = async () => {
    const data = await getStation(id);
    setStation(data);
    getStationReports(id).then(r => { if (Array.isArray(r)) setPublicReports(r); });
  };

  useEffect(() => {
    load();
    storage.get('staff').then(d => setStaffSession(d));
    storage.get('admin').then(d => {
      setAdminSession(d);
      if (d?.token) {
        getProvinces().then(setProvinces);
        adminGet('/fuel-types').then(r => Array.isArray(r) ? setFuelTypes(r) : null);
        adminGet('/brands').then(r => Array.isArray(r) ? setBrandsList(r) : null);
        adminGet('/staff').then(r => Array.isArray(r) ? setStaffList(r) : null);
      }
    });
    const onFuelUpdated = (data) => {
      if (data.station_id === id) load();
    };
    socket.on('fuel-updated', onFuelUpdated);
    return () => socket.off('fuel-updated', onFuelUpdated);
  }, [id]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openNavigation = () => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`);
  };

  const openPhone = () => {
    if (station.phone) Linking.openURL(`tel:${station.phone}`);
  };

  const shareStation = () => {
    Share.share({
      message: `${station.name}\n${station.address || station.province_name}\nดูสถานะน้ำมัน: ${DOMAIN}`,
    });
  };

  if (!station) return (
    <View style={styles.center}>
      <Text style={styles.loading}>กำลังโหลด...</Text>
    </View>
  );

  const availableCount = station.fuels?.filter(f => f.is_available).length || 0;
  const totalCount = station.fuels?.length || 0;
  const hasFuel = availableCount > 0;

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}>

      {/* Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandText}>{station.brand}</Text>
          </View>
          <View style={[styles.statusBadge, hasFuel ? styles.statusOk : styles.statusNo]}>
            <Text style={[styles.statusText, { color: hasFuel ? colors.fuelAvailable : colors.fuelEmpty }]}>
              {hasFuel ? '✓ มีน้ำมัน' : '✗ หมดน้ำมัน'}
            </Text>
          </View>
        </View>

        <Text style={styles.stationName}>{station.name}</Text>

        {station.address ? (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color={colors.onSurfaceVariant} />
            <Text style={styles.infoText}>{station.address}</Text>
          </View>
        ) : null}

        <View style={styles.infoRow}>
          <Ionicons name="map-outline" size={16} color={colors.onSurfaceVariant} />
          <Text style={styles.infoText}>{station.province_name}</Text>
        </View>

        {station.phone ? (
          <TouchableOpacity style={styles.infoRow} onPress={openPhone}>
            <Ionicons name="call-outline" size={16} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.primary }]}>{station.phone}</Text>
          </TouchableOpacity>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={openNavigation}>
            <Ionicons name="navigate" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>นำทาง</Text>
          </TouchableOpacity>
          {station.phone ? (
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnCall]} onPress={openPhone}>
              <Ionicons name="call" size={20} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>โทร</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnShare]} onPress={shareStation}>
            <Ionicons name="share-social" size={20} color={colors.onSurfaceVariant} />
            <Text style={[styles.actionBtnText, { color: colors.onSurfaceVariant }]}>แชร์</Text>
          </TouchableOpacity>
        </View>

        {/* Staff: อัปเดตน้ำมัน */}
        {staffSession?.token && String(staffSession?.station_id) === String(station.id) && (
          <TouchableOpacity style={styles.roleBtn} onPress={() => navigation.navigate('StaffDashboard')}>
            <Ionicons name="water" size={18} color="#fff" />
            <Text style={styles.roleBtnText}>อัปเดตสถานะน้ำมัน</Text>
          </TouchableOpacity>
        )}

        {/* Admin: แก้ไขปั๊ม (รวมอัปเดตน้ำมัน) */}
        {adminSession?.token && (
          <TouchableOpacity style={[styles.roleBtn, { backgroundColor: colors.admin }]} onPress={() => setShowEdit(true)}>
            <Ionicons name="create" size={18} color="#fff" />
            <Text style={styles.roleBtnText}>แก้ไขปั๊ม</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Fuel Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{totalCount}</Text>
            <Text style={styles.summaryLabel}>หัวจ่ายทั้งหมด</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: colors.fuelAvailable }]}>{availableCount}</Text>
            <Text style={styles.summaryLabel}>เปิดให้บริการ</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: colors.fuelEmpty }]}>{totalCount - availableCount}</Text>
            <Text style={styles.summaryLabel}>ปิด/หมด</Text>
          </View>
        </View>
      </View>

      {/* Fuel List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⛽ สถานะน้ำมัน</Text>
        {station.fuels?.map((f, i) => (
          <View key={i} style={styles.fuelCard}>
            <View style={[styles.fuelDot, { backgroundColor: f.is_available ? colors.fuelAvailable : colors.fuelEmpty }]} />
            <View style={styles.fuelInfo}>
              <Text style={styles.fuelName}>{f.fuel_type}</Text>
              <View style={styles.fuelMeta}>
                {f.remaining_cars != null && (
                  <Text style={styles.fuelMetaText}>🚗 ~{f.remaining_cars} คัน</Text>
                )}
                {f.updated_by && (
                  <Text style={styles.fuelMetaText}>👤 {f.updated_by}</Text>
                )}
              </View>
              {f.updated_at && (
                <Text style={styles.fuelTime}>อัปเดต {timeAgo(f.updated_at)}</Text>
              )}
            </View>
            <View style={[styles.fuelStatus, f.is_available ? styles.fuelStatusOk : styles.fuelStatusNo]}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: f.is_available ? colors.fuelAvailable : colors.fuelEmpty }}>
                {f.is_available ? 'มี' : 'หมด'}
              </Text>
            </View>
          </View>
        ))}
        {(!station.fuels || station.fuels.length === 0) && (
          <View style={styles.emptyFuel}>
            <Ionicons name="information-circle-outline" size={24} color={colors.outlineVariant} />
            <Text style={styles.emptyFuelText}>ยังไม่มีข้อมูลน้ำมัน</Text>
          </View>
        )}
      </View>

      {/* Public Reports */}
      {publicReports.length > 0 && (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <Text style={styles.sectionTitle}>📢 รายงานจากประชาชน</Text>
          {publicReports.map((r, i) => (
            <View key={i} style={{ backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadows.soft }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <View style={[styles.fuelStatus, r.is_available ? styles.fuelStatusOk : styles.fuelStatusNo]}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: r.is_available ? colors.fuelAvailable : colors.fuelEmpty }}>
                    {r.is_available ? 'มี' : 'หมด'}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.onSurface }}>{r.fuel_type}</Text>
                <View style={{ marginLeft: 'auto', backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>{r.confidence}%</Text>
                </View>
              </View>
              {r.reporters?.map((p, j) => (
                <View key={j} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  {p.picture && <Image source={{ uri: p.picture }} style={{ width: 18, height: 18, borderRadius: 9 }} />}
                  <Text style={{ fontSize: 12, color: '#666' }}>{p.name}</Text>
                  {p.distance_meters && <Text style={{ fontSize: 11, color: '#999', marginLeft: 'auto' }}>{Math.round(p.distance_meters)}m</Text>}
                </View>
              ))}
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 4 }}>{r.reporters?.length || 0} คนรายงาน</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />

      {/* Edit Modal */}
      {showEdit && (
        <StationFormModal
          data={station}
          provinces={provinces}
          fuelTypes={fuelTypes}
          staffList={staffList}
          brands={brandsList}
          onClose={() => setShowEdit(false)}
          onSave={() => { load(); setShowEdit(false); }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { fontSize: 16, color: colors.onSurfaceVariant },

  heroCard: { backgroundColor: '#fff', margin: spacing.lg, borderRadius: radius.lg, padding: spacing.xl, ...shadows.ambient },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  brandBadge: { backgroundColor: colors.surfaceLow, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.xl },
  brandText: { fontSize: 12, fontWeight: '700', color: colors.onSurfaceVariant },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.xl },
  statusOk: { backgroundColor: colors.fuelAvailableBg },
  statusNo: { backgroundColor: colors.fuelEmptyBg },
  statusText: { fontSize: 12, fontWeight: '600' },

  stationName: { fontSize: 20, fontWeight: '800', color: colors.onSurface, marginBottom: spacing.md },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  infoText: { fontSize: 14, color: colors.onSurfaceVariant, flex: 1 },

  actions: { flexDirection: 'row', gap: 8, marginTop: spacing.lg },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.fuelAvailable },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  actionBtnCall: { backgroundColor: '#e8f0fe' },
  actionBtnShare: { backgroundColor: colors.surfaceLow },

  summaryCard: { backgroundColor: '#fff', marginHorizontal: spacing.lg, borderRadius: radius.lg, padding: spacing.lg, ...shadows.soft },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: 24, fontWeight: '800', color: colors.onSurface },
  summaryLabel: { fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  summaryDivider: { width: 1, height: 30, backgroundColor: colors.surfaceVariant },

  section: { margin: spacing.lg, marginTop: spacing.xl },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.md },

  fuelCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm, ...shadows.soft },
  fuelDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.md },
  fuelInfo: { flex: 1 },
  fuelName: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  fuelMeta: { flexDirection: 'row', gap: 12, marginTop: 3 },
  fuelMetaText: { fontSize: 12, color: colors.onSurfaceVariant },
  fuelTime: { fontSize: 11, color: colors.outlineVariant, marginTop: 2 },
  fuelStatus: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.xl },
  fuelStatusOk: { backgroundColor: colors.fuelAvailableBg },
  fuelStatusNo: { backgroundColor: colors.fuelEmptyBg },

  emptyFuel: { alignItems: 'center', padding: spacing.xxxl, gap: 8 },
  emptyFuelText: { fontSize: 14, color: colors.outlineVariant },

  roleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.sm, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.staffGreen },
  roleBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
