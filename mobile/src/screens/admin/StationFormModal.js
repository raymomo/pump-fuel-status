import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, FlatList, Switch, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapPickerModal from '../../components/MapPickerModal';
import { DOMAIN, adminPost, adminPut, adminGet, adminDelete } from '../../utils/api';
import { storage } from '../../utils/storage';

const BASE_URL = `${DOMAIN}/api`;
const adminUpdateFuel = async (body) => {
  const data = await storage.get('admin');
  return fetch(`${BASE_URL}/staff/fuel-status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.token}` },
    body: JSON.stringify(body),
  });
};
import { colors, spacing, radius } from '../../styles/theme';

export default function StationFormModal({ data, provinces, fuelTypes, staffList, brands, onClose, onSave, onEdit }) {
  const brandNames = (brands || []).map(b => b.name);
  const isEdit = !!data;
  const [form, setForm] = useState({
    name: data?.name || '', brand: data?.brand || 'PTT', address: data?.address || '',
    province_id: data?.province_id || '', lat: data?.lat ? String(data.lat) : '', lng: data?.lng ? String(data.lng) : '',
    phone: data?.phone || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [picker, setPicker] = useState(null); // 'province' | 'brand' | 'addStaff'

  // Fuel types for this station (edit mode)
  const [stationFuels, setStationFuels] = useState([]);
  const [stationStaff, setStationStaff] = useState([]);
  const [liveStatus, setLiveStatus] = useState([]); // fuel_status rows
  const [editCars, setEditCars] = useState({});
  const [savingFuel, setSavingFuel] = useState(null);

  const loadLiveStatus = async () => {
    try {
      const res = await fetch(`${DOMAIN}/api/staff/station/${data.id}/fuels`);
      const rows = await res.json();
      if (Array.isArray(rows)) {
        setLiveStatus(rows);
        const c = {};
        rows.forEach(f => { c[f.fuel_type] = f.remaining_cars != null ? String(f.remaining_cars) : ''; });
        setEditCars(c);
      }
    } catch {}
  };

  useEffect(() => {
    if (isEdit && data?.id) {
      adminGet(`/stations/${data.id}/fuels`).then(d => Array.isArray(d) ? setStationFuels(d) : null);
      adminGet(`/stations/${data.id}/staff`).then(d => Array.isArray(d) ? setStationStaff(d) : null);
      loadLiveStatus();
    }
  }, []);

  const handleSave = async () => {
    if (!form.name || !form.address) { setError('กรุณากรอกชื่อและที่อยู่'); return; }
    setSaving(true); setError('');
    try {
      const body = { ...form, province_id: parseInt(form.province_id), lat: parseFloat(form.lat) || 0, lng: parseFloat(form.lng) || 0 };
      if (isEdit) {
        await adminPut(`/stations/${data.id}`, body);
        onSave(); onClose();
      } else {
        const created = await adminPost('/stations', body);
        onSave();
        // สร้างเสร็จ → เปิด edit ต่อเลยเพื่อเพิ่มน้ำมัน+พนักงาน
        if (created?.id && onEdit) {
          onClose();
          setTimeout(() => onEdit(created), 300);
        } else {
          onClose();
        }
      }
    } catch { setError('บันทึกไม่สำเร็จ'); }
    setSaving(false);
  };

  const toggleFuel = async (fuel) => {
    const enabled = stationFuels.some(f => f.name === fuel.name && f.enabled);
    if (enabled) {
      await adminDelete(`/stations/${data.id}/fuels/${encodeURIComponent(fuel.name)}`);
    } else {
      await adminPost(`/stations/${data.id}/fuels`, { fuel_type: fuel.name });
    }
    const updated = await adminGet(`/stations/${data.id}/fuels`);
    if (Array.isArray(updated)) setStationFuels(updated);
  };

  const addStaff = async (staffId) => {
    await adminPost(`/stations/${data.id}/staff`, { staff_id: staffId });
    const updated = await adminGet(`/stations/${data.id}/staff`);
    if (Array.isArray(updated)) setStationStaff(updated);
    setPicker(null);
  };

  const removeStaff = (staff) => {
    Alert.alert('ลบพนักงาน', `ลบ "${staff.name}" ออกจากปั๊มนี้?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: async () => {
        await adminDelete(`/stations/${data.id}/staff/${staff.id}`);
        const updated = await adminGet(`/stations/${data.id}/staff`);
        if (Array.isArray(updated)) setStationStaff(updated);
      }},
    ]);
  };

  const selectedProvince = provinces.find(p => p.id == form.province_id);
  const assignedIds = stationStaff.map(st => st.id);
  const availableStaff = (staffList || []).filter(st => !assignedIds.includes(st.id) && !st.station_id);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
          <Text style={s.headerTitle}>{isEdit ? 'แก้ไขปั๊ม' : 'เพิ่มปั๊ม'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[s.saveText, saving && { opacity: 0.5 }]}>{saving ? 'บันทึก...' : 'บันทึก'}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
          {error ? <Text style={s.error}>{error}</Text> : null}

          <Text style={s.label}>ชื่อปั๊ม *</Text>
          <TextInput style={s.input} value={form.name} onChangeText={v => setForm({...form, name: v})} placeholder="ชื่อปั๊ม" />

          {/* Brand dropdown */}
          <Text style={s.label}>แบรนด์</Text>
          <TouchableOpacity style={s.dropdown} onPress={() => setPicker('brand')}>
            <Text style={s.dropdownText}>{form.brand || 'เลือกแบรนด์'}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.onSurfaceVariant} />
          </TouchableOpacity>

          {/* Province dropdown */}
          <Text style={s.label}>จังหวัด</Text>
          <TouchableOpacity style={s.dropdown} onPress={() => setPicker('province')}>
            <Text style={[s.dropdownText, !selectedProvince && { color: colors.outlineVariant }]}>
              {selectedProvince?.name || 'เลือกจังหวัด'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.onSurfaceVariant} />
          </TouchableOpacity>

          <Text style={s.label}>ที่อยู่ *</Text>
          <TextInput style={[s.input, { minHeight: 60 }]} value={form.address} onChangeText={v => setForm({...form, address: v})} placeholder="ที่อยู่" multiline />

          <Text style={s.label}>📍 ตำแหน่ง</Text>
          <TouchableOpacity style={s.locBtn} onPress={() => setPicker('map')}>
            <Ionicons name="map" size={16} color="#fff" />
            <Text style={s.locBtnText}>{form.lat && form.lng ? `✓ ${parseFloat(form.lat).toFixed(5)}, ${parseFloat(form.lng).toFixed(5)}` : 'เลือกตำแหน่งจากแผนที่'}</Text>
          </TouchableOpacity>

          <Text style={s.label}>โทรศัพท์</Text>
          <TextInput style={s.input} value={form.phone} onChangeText={v => setForm({...form, phone: v})} keyboardType="phone-pad" placeholder="0xx-xxx-xxxx" />

          {/* ===== Fuel Types (edit mode) ===== */}
          {isEdit && fuelTypes?.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>⛽ ชนิดน้ำมัน</Text>
              {fuelTypes.map(ft => {
                const enabled = stationFuels.some(f => f.name === ft.name && f.enabled);
                const live = liveStatus.find(f => f.fuel_type === ft.name);
                return (
                  <View key={ft.name} style={[s.fuelRow, { flexDirection: 'column', alignItems: 'stretch' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[s.fuelName, { flex: 1 }]}>{ft.name}</Text>
                      <Switch
                        value={enabled}
                        onValueChange={() => toggleFuel(ft)}
                        trackColor={{ false: '#ddd', true: colors.fuelAvailable }}
                        thumbColor="#fff"
                      />
                    </View>
                    {enabled && live && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
                        <TouchableOpacity
                          style={[s.statusToggle, live.is_available ? s.statusOn : s.statusOff]}
                          onPress={async () => {
                            setSavingFuel(ft.name);
                            await adminUpdateFuel({ station_id: data.id, fuel_type: ft.name, is_available: !live.is_available, staff_name: 'Admin', remaining_cars: !live.is_available ? (parseInt(editCars[ft.name]) || null) : null });
                            await loadLiveStatus();
                            setSavingFuel(null);
                          }}
                          disabled={savingFuel === ft.name}
                        >
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{live.is_available ? '✓ มี' : '✗ หมด'}</Text>
                        </TouchableOpacity>
                        {live.is_available && (
                          <>
                            <TextInput
                              style={s.carsInput}
                              value={editCars[ft.name] || ''}
                              onChangeText={v => setEditCars({...editCars, [ft.name]: v})}
                              onEndEditing={async () => {
                                setSavingFuel(ft.name);
                                await adminUpdateFuel({ station_id: data.id, fuel_type: ft.name, is_available: true, staff_name: 'Admin', remaining_cars: editCars[ft.name] ? parseInt(editCars[ft.name]) : null });
                                await loadLiveStatus();
                                setSavingFuel(null);
                              }}
                              keyboardType="numeric"
                              placeholder="0"
                            />
                            <Text style={{ fontSize: 11, color: colors.onSurfaceVariant }}>คัน</Text>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* ===== Staff (edit mode) ===== */}
          {isEdit && (
            <View style={s.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={s.sectionTitle}>👤 พนักงาน ({stationStaff.length})</Text>
                <TouchableOpacity style={s.addStaffBtn} onPress={() => setPicker('addStaff')}>
                  <Ionicons name="person-add" size={14} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12, marginLeft: 4 }}>เพิ่ม</Text>
                </TouchableOpacity>
              </View>
              {stationStaff.map(st => (
                <View key={st.id} style={s.staffRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.staffName}>{st.name}</Text>
                    <Text style={s.staffSub}>@{st.username}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeStaff(st)} style={s.removeBtn}>
                    <Ionicons name="close-circle" size={22} color={colors.fuelEmpty} />
                  </TouchableOpacity>
                </View>
              ))}
              {stationStaff.length === 0 && <Text style={s.emptyText}>ยังไม่มีพนักงาน</Text>}
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>

      {/* Brand Picker */}
      {picker === 'brand' && (
        <PickerList
          title="เลือกแบรนด์"
          data={brandNames.map(b => ({ id: b, name: b }))}
          selected={form.brand}
          onSelect={(id) => { setForm({...form, brand: id}); setPicker(null); }}
          onClose={() => setPicker(null)}
        />
      )}

      {/* Province Picker */}
      {picker === 'province' && (
        <PickerList
          title="เลือกจังหวัด"
          data={provinces}
          selected={String(form.province_id)}
          onSelect={(id) => { setForm({...form, province_id: id}); setPicker(null); }}
          onClose={() => setPicker(null)}
          searchable
        />
      )}

      {/* Add Staff Picker */}
      {picker === 'addStaff' && (
        <PickerList
          title="เพิ่มพนักงาน"
          data={availableStaff.map(st => ({ id: st.id, name: `${st.name} (@${st.username})` }))}
          selected=""
          onSelect={(id) => addStaff(id)}
          onClose={() => setPicker(null)}
          searchable
        />
      )}

      {/* Map Picker */}
      {picker === 'map' && (
        <MapPickerModal
          lat={form.lat ? parseFloat(form.lat) : 13.75}
          lng={form.lng ? parseFloat(form.lng) : 100.5}
          onSelect={(lat, lng) => { setForm({...form, lat: String(lat), lng: String(lng)}); setPicker(null); }}
          onClose={() => setPicker(null)}
        />
      )}
    </Modal>
  );
}

function PickerList({ title, data, selected, onSelect, onClose, searchable }) {
  const [q, setQ] = useState('');
  const filtered = searchable && q ? data.filter(d => d.name.toLowerCase().includes(q.toLowerCase())) : data;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
          <Text style={s.headerTitle}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>
        {searchable && (
          <TextInput
            style={[s.input, { margin: spacing.md }]}
            placeholder="🔍 ค้นหา..."
            value={q} onChangeText={setQ}
            placeholderTextColor={colors.outlineVariant}
          />
        )}
        <FlatList
          data={filtered}
          keyExtractor={d => String(d.id)}
          renderItem={({ item: d }) => {
            const active = String(d.id) === String(selected);
            return (
              <TouchableOpacity style={[s.pickerItem, active && { backgroundColor: colors.admin + '10' }]} onPress={() => onSelect(d.id)}>
                <Text style={[s.pickerText, active && { color: colors.admin, fontWeight: '700' }]}>{d.name}</Text>
                {active && <Ionicons name="checkmark-circle" size={20} color={colors.admin} />}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceLow, paddingTop: 50 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  saveText: { fontSize: 15, fontWeight: '700', color: colors.admin },
  body: { padding: spacing.lg },
  label: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant, marginBottom: 4, marginTop: spacing.sm },
  input: { padding: 14, borderWidth: 1.5, borderColor: colors.surfaceVariant, borderRadius: radius.md, fontSize: 15, backgroundColor: colors.surfaceLow, marginBottom: spacing.sm },
  error: { backgroundColor: colors.fuelEmptyBg, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md, color: colors.fuelEmpty, fontSize: 13, textAlign: 'center' },

  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderWidth: 1.5, borderColor: colors.surfaceVariant, borderRadius: radius.md, backgroundColor: colors.surfaceLow, marginBottom: spacing.sm },
  dropdownText: { fontSize: 15, color: colors.onSurface },

  locBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#7c3aed', paddingVertical: 12, borderRadius: radius.md, marginBottom: spacing.sm },
  locBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  gpsBtn: { position: 'absolute', bottom: 80, right: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: '#0891b2', alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },

  section: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.surfaceLow },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.sm },

  fuelRow: { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.surfaceLow },
  fuelName: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  statusToggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.xl },
  statusOn: { backgroundColor: colors.fuelAvailable },
  statusOff: { backgroundColor: colors.fuelEmpty },
  carsInput: { width: 50, padding: 4, borderWidth: 1, borderColor: colors.surfaceVariant, borderRadius: radius.sm, fontSize: 13, textAlign: 'center', backgroundColor: '#fff' },

  addStaffBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.admin, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6 },
  staffRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.surfaceLow },
  staffName: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  staffSub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 1 },
  removeBtn: { padding: 4 },
  emptyText: { fontSize: 13, color: colors.outlineVariant, textAlign: 'center', paddingVertical: spacing.md },

  pickerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.lg, borderBottomWidth: 0.5, borderBottomColor: colors.surfaceLow },
  pickerText: { flex: 1, fontSize: 15, color: colors.onSurface },
});
