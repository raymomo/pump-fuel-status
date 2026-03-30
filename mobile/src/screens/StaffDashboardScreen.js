import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Switch, Alert, RefreshControl, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapPickerModal from '../components/MapPickerModal';
import { getStationFuels, updateFuelStatus, staffCheck, getStationsList, requestJoinStation, requestNewStation, getMyJoinRequests, getMyStationRequests, getProvinces, getBrands } from '../utils/api';
import { storage } from '../utils/storage';
import { timeAgo } from '../utils/helpers';
import { colors, spacing, radius, shadows } from '../styles/theme';
import socket from '../utils/socket';

export default function StaffDashboardScreen({ navigation }) {
  const [staff, setStaff] = useState(null);
  const [fuels, setFuels] = useState([]);
  const [cars, setCars] = useState({});
  const [saving, setSaving] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('join'); // join | new
  const [stationsList, setStationsList] = useState([]);
  const [searchStation, setSearchStation] = useState('');
  const [newStation, setNewStation] = useState({ name: '', brand: '', address: '', province: '', lat: '', lng: '' });
  const [myJoinReqs, setMyJoinReqs] = useState([]);
  const [myStationReqs, setMyStationReqs] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [brandOptions, setBrandOptions] = useState([]);
  const [picker, setPicker] = useState(null); // 'brand' | 'province' | 'joinProvince' | 'joinBrand'
  const [joinProvince, setJoinProvince] = useState('');
  const [joinBrand, setJoinBrand] = useState('');

  useEffect(() => {
    loadStaff();
    getProvinces().then(setProvinces);
    getBrands().then(r => Array.isArray(r) ? setBrandOptions(r) : null);
  }, []);

  const loadStaff = async () => {
    const data = await storage.get('staff');
    if (!data) { navigation.replace('StaffLogin'); return; }
    // ดึงข้อมูลล่าสุดจาก server
    try {
      const fresh = await staffCheck(data.id);
      const updated = { ...data, ...fresh };
      await storage.set('staff', updated);
      setStaff(updated);
      loadFuels(updated.station_id);
    } catch {
      setStaff(data);
      loadFuels(data.station_id);
    }
  };

  const loadFuels = async (stationId) => {
    if (!stationId) return;
    const data = await getStationFuels(stationId);
    setFuels(data);
    const c = {};
    data.forEach(f => { c[f.fuel_type] = f.remaining_cars != null ? String(f.remaining_cars) : ''; });
    setCars(c);
  };

  useEffect(() => {
    if (!staff?.station_id) return;
    const onUpdate = (data) => {
      if (data.station_id === staff.station_id) loadFuels(staff.station_id);
    };
    socket.on('fuel-updated', onUpdate);
    return () => socket.off('fuel-updated', onUpdate);
  }, [staff]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (staff?.station_id) await loadFuels(staff.station_id);
    setRefreshing(false);
  };

  const toggleFuel = async (fuel) => {
    const newStatus = !fuel.is_available;
    setSaving(fuel.fuel_type);
    try {
      await updateFuelStatus({
        station_id: staff.station_id,
        fuel_type: fuel.fuel_type,
        is_available: newStatus,
        staff_name: staff.name,
        remaining_cars: newStatus ? (cars[fuel.fuel_type] ? parseInt(cars[fuel.fuel_type]) : null) : null,
      });
      await loadFuels(staff.station_id);
    } catch { Alert.alert('ผิดพลาด', 'ไม่สามารถอัปเดตได้'); }
    setSaving(null);
  };

  const saveCars = async (fuel) => {
    setSaving(fuel.fuel_type);
    try {
      await updateFuelStatus({
        station_id: staff.station_id,
        fuel_type: fuel.fuel_type,
        is_available: fuel.is_available,
        staff_name: staff.name,
        remaining_cars: cars[fuel.fuel_type] ? parseInt(cars[fuel.fuel_type]) : null,
      });
      await loadFuels(staff.station_id);
    } catch { Alert.alert('ผิดพลาด', 'ไม่สามารถบันทึกได้'); }
    setSaving(null);
  };


  if (!staff) return <View style={styles.center}><Text style={styles.loading}>กำลังโหลด...</Text></View>;

  const loadNoStation = async () => {
    const [stations, joins, reqs] = await Promise.all([
      getStationsList(),
      getMyJoinRequests(staff.id),
      getMyStationRequests(staff.id),
    ]);
    setStationsList(stations);
    setMyJoinReqs(joins);
    setMyStationReqs(reqs);
  };

  const handleJoin = async (stationId) => {
    try {
      await requestJoinStation({ staff_id: staff.id, station_id: stationId });
      Alert.alert('สำเร็จ', 'ส่งคำขอเข้าร่วมปั๊มแล้ว รอ Admin อนุมัติ');
      loadNoStation();
    } catch { Alert.alert('ผิดพลาด', 'ไม่สามารถส่งคำขอได้'); }
  };

  const handleNewStation = async () => {
    if (!newStation.name || !newStation.brand) { Alert.alert('กรุณากรอกข้อมูล', 'ชื่อปั๊มและแบรนด์จำเป็น'); return; }
    try {
      await requestNewStation({ ...newStation, staff_id: staff.id });
      Alert.alert('สำเร็จ', 'ส่งคำขอเพิ่มปั๊มใหม่แล้ว รอ Admin อนุมัติ');
      setNewStation({ name: '', brand: '', address: '', province: '' });
      loadNoStation();
    } catch { Alert.alert('ผิดพลาด', 'ไม่สามารถส่งคำขอได้'); }
  };

  if (!staff.station_id) {
    if (stationsList.length === 0 && myJoinReqs.length === 0) loadNoStation();

    const brands = [...new Set(stationsList.map(s => s.brand).filter(Boolean))].sort();
    const filteredStations = stationsList.filter(s => {
      if (searchStation && !s.name.toLowerCase().includes(searchStation.toLowerCase()) && !s.brand?.toLowerCase().includes(searchStation.toLowerCase())) return false;
      if (joinProvince && s.province_name !== joinProvince) return false;
      if (joinBrand && s.brand !== joinBrand) return false;
      return true;
    });

    return (
      <ScrollView style={styles.container}>
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>สวัสดี, {staff.name}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>ยังไม่ได้เชื่อมกับปั๊ม</Text>
            </View>
          </View>
        </View>

        {/* Tab Switch */}
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tabBtn, tab === 'join' && styles.tabBtnActive]} onPress={() => setTab('join')}>
            <Text style={[styles.tabText, tab === 'join' && styles.tabTextActive]}>ขอเข้าร่วมปั๊ม</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, tab === 'new' && styles.tabBtnActive]} onPress={() => setTab('new')}>
            <Text style={[styles.tabText, tab === 'new' && styles.tabTextActive]}>ขอเพิ่มปั๊มใหม่</Text>
          </TouchableOpacity>
        </View>

        {tab === 'join' && (
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.sm }}>
              <TouchableOpacity style={[styles.dropdownBtn, { flex: 1 }, joinProvince && { borderColor: colors.staffGreen, backgroundColor: colors.staffGreen + '15' }]} onPress={() => setPicker('joinProvince')}>
                <Ionicons name="location-outline" size={14} color={joinProvince ? colors.staffGreen : colors.onSurfaceVariant} />
                <Text style={[styles.dropdownText, { flex: 1, fontSize: 12 }, joinProvince && { color: colors.staffGreen }]} numberOfLines={1}>{joinProvince || 'จังหวัด'}</Text>
                <Ionicons name="chevron-down" size={14} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dropdownBtn, { flex: 1 }, joinBrand && { borderColor: colors.staffGreen, backgroundColor: colors.staffGreen + '15' }]} onPress={() => setPicker('joinBrand')}>
                <Ionicons name="pricetag-outline" size={14} color={joinBrand ? colors.staffGreen : colors.onSurfaceVariant} />
                <Text style={[styles.dropdownText, { flex: 1, fontSize: 12 }, joinBrand && { color: colors.staffGreen }]} numberOfLines={1}>{joinBrand || 'แบรนด์'}</Text>
                <Ionicons name="chevron-down" size={14} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
            <TextInput style={styles.searchInput} placeholder="🔍 ค้นหาปั๊ม..." value={searchStation} onChangeText={setSearchStation} placeholderTextColor={colors.outlineVariant} />
            {filteredStations.slice(0, 20).map(s => {
              const requested = myJoinReqs.some(r => r.station_id === s.id);
              return (
                <View key={s.id} style={styles.stationItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stationName}>{s.name}</Text>
                    <Text style={styles.stationSub}>{s.province_name} · {s.brand}</Text>
                  </View>
                  {requested ? (
                    <View style={styles.pendingBadge}><Text style={styles.pendingText}>รออนุมัติ</Text></View>
                  ) : (
                    <TouchableOpacity style={styles.joinBtn} onPress={() => handleJoin(s.id)}>
                      <Text style={styles.joinBtnText}>ขอเข้าร่วม</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {tab === 'new' && (
          <View style={styles.section}>
            <Text style={styles.inputLabel}>ชื่อปั๊ม *</Text>
            <TextInput style={styles.formInput} placeholder="เช่น PTT สาขาเมือง" value={newStation.name} onChangeText={v => setNewStation({ ...newStation, name: v })} />
            <Text style={styles.inputLabel}>แบรนด์ *</Text>
            <TouchableOpacity style={styles.dropdownBtn} onPress={() => setPicker('brand')}>
              <Text style={[styles.dropdownText, !newStation.brand && { color: colors.outlineVariant }]}>{newStation.brand || 'เลือกแบรนด์'}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <Text style={styles.inputLabel}>ที่อยู่</Text>
            <TextInput style={styles.formInput} placeholder="ที่อยู่ปั๊ม" value={newStation.address} onChangeText={v => setNewStation({ ...newStation, address: v })} />
            <Text style={styles.inputLabel}>จังหวัด *</Text>
            <TouchableOpacity style={styles.dropdownBtn} onPress={() => setPicker('province')}>
              <Text style={[styles.dropdownText, !newStation.province && { color: colors.outlineVariant }]}>{newStation.province || 'เลือกจังหวัด'}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <Text style={styles.inputLabel}>📍 ตำแหน่ง</Text>
            <TouchableOpacity style={[styles.dropdownBtn, { gap: 6 }]} onPress={() => setPicker('map')}>
              <Ionicons name="map" size={16} color={newStation.lat ? colors.staffGreen : colors.onSurfaceVariant} />
              <Text style={[styles.dropdownText, { flex: 1 }, !newStation.lat && { color: colors.outlineVariant }]}>
                {newStation.lat ? `✓ ${parseFloat(newStation.lat).toFixed(5)}, ${parseFloat(newStation.lng).toFixed(5)}` : 'เลือกตำแหน่งจากแผนที่'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceVariant} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitBtn} onPress={handleNewStation}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.submitBtnText}>ส่งคำขอเพิ่มปั๊ม</Text>
            </TouchableOpacity>

            {myStationReqs.length > 0 && (
              <View style={{ marginTop: spacing.lg }}>
                <Text style={styles.sectionTitle}>คำขอของฉัน</Text>
                {myStationReqs.map((r, i) => (
                  <View key={i} style={styles.reqItem}>
                    <Text style={styles.reqName}>{r.name}</Text>
                    <View style={[styles.pendingBadge, r.status === 'approved' && { backgroundColor: colors.fuelAvailableBg }, r.status === 'rejected' && { backgroundColor: colors.fuelEmptyBg }]}>
                      <Text style={[styles.pendingText, r.status === 'approved' && { color: colors.fuelAvailable }, r.status === 'rejected' && { color: colors.fuelEmpty }]}>
                        {r.status === 'pending' ? 'รออนุมัติ' : r.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />

        {/* Brand Picker */}
        {picker === 'brand' && (
          <PickerModal
            title="เลือกแบรนด์"
            data={brandOptions.map(b => ({ id: b.name, name: b.name }))}
            selected={newStation.brand}
            onSelect={(v) => { setNewStation({ ...newStation, brand: v }); setPicker(null); }}
            onClose={() => setPicker(null)}
          />
        )}

        {/* Map Picker */}
        {picker === 'map' && (
          <MapPickerModal
            lat={newStation.lat ? parseFloat(newStation.lat) : 13.75}
            lng={newStation.lng ? parseFloat(newStation.lng) : 100.5}
            onSelect={(lat, lng) => { setNewStation({ ...newStation, lat: String(lat), lng: String(lng) }); setPicker(null); }}
            onClose={() => setPicker(null)}
          />
        )}

        {/* Province Picker */}
        {picker === 'province' && (
          <PickerModal
            title="เลือกจังหวัด"
            data={provinces}
            selected={newStation.province}
            onSelect={(v) => { const p = provinces.find(x => String(x.id) === String(v)); setNewStation({ ...newStation, province: p?.name || v }); setPicker(null); }}
            onClose={() => setPicker(null)}
            searchable
          />
        )}

        {picker === 'joinProvince' && (
          <PickerModal
            title="กรองจังหวัด"
            data={[{ id: '', name: 'ทุกจังหวัด' }, ...provinces]}
            selected={joinProvince}
            onSelect={(v) => { const p = provinces.find(x => String(x.id) === String(v)); setJoinProvince(p?.name || ''); setPicker(null); }}
            onClose={() => setPicker(null)}
            searchable
          />
        )}

        {picker === 'joinBrand' && (
          <PickerModal
            title="กรองแบรนด์"
            data={[{ id: '', name: 'ทุกแบรนด์' }, ...brands.map(b => ({ id: b, name: b }))]}
            selected={joinBrand}
            onSelect={(v) => { setJoinBrand(v || ''); setPicker(null); }}
            onClose={() => setPicker(null)}
          />
        )}
      </ScrollView>
    );
  }

  const availableCount = fuels.filter(f => f.is_available).length;

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.staffGreen]} />}>
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>สวัสดี, {staff.name}</Text>
            <Text style={styles.stationName}>{staff.station_name}</Text>
            {staff.station_address && <Text style={styles.stationInfo}>📍 {staff.station_address}</Text>}
            {staff.station_province && <Text style={styles.stationInfo}>🏛️ {staff.station_province} {staff.station_brand ? `· ${staff.station_brand}` : ''}</Text>}
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{fuels.length}</Text>
            <Text style={styles.summaryLabel}>หัวจ่ายทั้งหมด</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: '#a7f3d0' }]}>{availableCount}</Text>
            <Text style={styles.summaryLabel}>เปิดอยู่</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: '#fca5a5' }]}>{fuels.length - availableCount}</Text>
            <Text style={styles.summaryLabel}>ปิด/หมด</Text>
          </View>
        </View>
      </View>

      {/* Fuel Cards */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⛽ จัดการสถานะน้ำมัน</Text>
        {fuels.map(f => (
          <View key={f.fuel_type} style={styles.fuelCard}>
            <View style={styles.fuelTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fuelName}>{f.fuel_type}</Text>
                <View style={styles.fuelMetaRow}>
                  {f.updated_by && <Text style={styles.fuelMeta}>👤 {f.updated_by}</Text>}
                  {f.updated_at && <Text style={styles.fuelMeta}>🕐 {timeAgo(f.updated_at)}</Text>}
                </View>
                <View style={[styles.statusChip, f.is_available ? styles.statusChipOk : styles.statusChipNo]}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: f.is_available ? colors.fuelAvailable : colors.fuelEmpty }}>
                    {f.is_available ? '✓ มีน้ำมัน' : '✗ หมด'}
                  </Text>
                </View>
              </View>
              <Switch
                value={f.is_available}
                onValueChange={() => toggleFuel(f)}
                disabled={saving === f.fuel_type}
                trackColor={{ false: colors.fuelEmpty, true: colors.fuelAvailable }}
                thumbColor="#fff"
              />
            </View>

            {f.is_available && (
              <View style={styles.carsRow}>
                <Text style={styles.carsLabel}>รองรับอีกประมาณ</Text>
                <TextInput
                  style={styles.carsInput}
                  keyboardType="numeric"
                  placeholder="0"
                  value={cars[f.fuel_type]}
                  onChangeText={v => setCars({ ...cars, [f.fuel_type]: v })}
                />
                <Text style={styles.carsUnit}>คัน</Text>
                <TouchableOpacity style={[styles.carsBtn, saving === f.fuel_type && { opacity: 0.5 }]} onPress={() => saveCars(f)} disabled={saving === f.fuel_type}>
                  <Text style={styles.carsBtnText}>บันทึก</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  loading: { fontSize: 16, color: colors.onSurfaceVariant },

  noStationTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, marginTop: spacing.lg },
  noStationSub: { fontSize: 14, color: colors.onSurfaceVariant, marginTop: spacing.sm, textAlign: 'center' },
  logoutBtnAlt: { marginTop: spacing.xl, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.fuelEmptyBg, borderRadius: radius.md },
  logoutBtnAltText: { color: colors.fuelEmpty, fontWeight: '600' },

  headerCard: { backgroundColor: colors.staffGreen, padding: spacing.xl, paddingBottom: spacing.lg },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  stationName: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 2 },
  stationInfo: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  logoutBtn: { flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center' },
  logoutText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, padding: spacing.md },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: 22, fontWeight: '800', color: '#fff' },
  summaryLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },

  section: { padding: spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.md },

  fuelCard: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm, ...shadows.soft },
  fuelTop: { flexDirection: 'row', alignItems: 'center' },
  fuelName: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  fuelMetaRow: { flexDirection: 'row', gap: 10, marginTop: 3 },
  fuelMeta: { fontSize: 11, color: colors.outlineVariant },
  statusChip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.xl, marginTop: 6 },
  statusChipOk: { backgroundColor: colors.fuelAvailableBg },
  statusChipNo: { backgroundColor: colors.fuelEmptyBg },

  carsRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.surfaceLow, gap: 6 },
  carsLabel: { fontSize: 12, color: colors.onSurfaceVariant },
  carsInput: { width: 60, padding: 6, borderWidth: 1.5, borderColor: colors.surfaceVariant, borderRadius: radius.sm, fontSize: 14, textAlign: 'center', backgroundColor: colors.surfaceLow },
  carsUnit: { fontSize: 13, color: colors.onSurfaceVariant },
  carsBtn: { backgroundColor: colors.staffGreen, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.sm },
  carsBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  tabRow: { flexDirection: 'row', margin: spacing.lg, marginBottom: 0, backgroundColor: colors.surfaceLow, borderRadius: radius.md, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.sm },
  tabBtnActive: { backgroundColor: '#fff', ...shadows.soft },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  tabTextActive: { color: colors.staffGreen },

  searchInput: { padding: 12, backgroundColor: '#fff', borderRadius: radius.md, fontSize: 14, marginBottom: spacing.md, ...shadows.soft },
  stationItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadows.soft },
  stationName: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  stationSub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
  joinBtn: { backgroundColor: colors.staffGreen, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm },
  joinBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  pendingBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.xl },
  pendingText: { fontSize: 11, fontWeight: '600', color: '#92400e' },

  inputLabel: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant, marginBottom: 4, marginTop: spacing.sm },
  formInput: { padding: 12, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.surfaceVariant, borderRadius: radius.md, fontSize: 14 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.staffGreen, padding: 14, borderRadius: radius.md, marginTop: spacing.lg },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  reqItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadows.soft },
  reqName: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.surfaceVariant, borderRadius: radius.md },
  dropdownText: { fontSize: 14, color: colors.onSurface },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: colors.surfaceLow },
  pickerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  pickerSearch: { margin: spacing.md, padding: 12, borderWidth: 1.5, borderColor: colors.surfaceVariant, borderRadius: radius.md, fontSize: 14, backgroundColor: colors.surfaceLow },
  pickerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.lg, borderBottomWidth: 0.5, borderBottomColor: colors.surfaceLow },
  pickerItemText: { flex: 1, fontSize: 15, color: colors.onSurface },
});

function PickerModal({ title, data, selected, onSelect, onClose, searchable }) {
  const [q, setQ] = useState('');
  const filtered = searchable && q ? data.filter(d => d.name.toLowerCase().includes(q.toLowerCase())) : data;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
          <Text style={styles.pickerTitle}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>
        {searchable && (
          <TextInput style={styles.pickerSearch} placeholder="🔍 ค้นหา..." value={q} onChangeText={setQ} placeholderTextColor={colors.outlineVariant} />
        )}
        <FlatList
          data={filtered}
          keyExtractor={d => String(d.id)}
          renderItem={({ item: d }) => {
            const active = String(d.id) === String(selected) || d.name === selected;
            return (
              <TouchableOpacity style={[styles.pickerItem, active && { backgroundColor: colors.staffGreen + '10' }]} onPress={() => onSelect(d.id)}>
                <Text style={[styles.pickerItemText, active && { color: colors.staffGreen, fontWeight: '700' }]}>{d.name}</Text>
                {active && <Ionicons name="checkmark-circle" size={20} color={colors.staffGreen} />}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

