import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminPost, adminPut } from '../../utils/api';
import { colors, spacing, radius } from '../../styles/theme';

export default function StaffFormModal({ data, stations, onClose, onSave }) {
  const isEdit = !!data;
  const [form, setForm] = useState({
    name: data?.name || '', username: data?.username || '', password: '', station_id: data?.station_id || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showStations, setShowStations] = useState(false);
  const [stationSearch, setStationSearch] = useState('');

  const handleSave = async () => {
    if (!form.name || !form.username) { setError('กรุณากรอกชื่อและ username'); return; }
    if (!isEdit && !form.password) { setError('กรุณากรอกรหัสผ่าน'); return; }
    setSaving(true); setError('');
    try {
      const body = { ...form, station_id: form.station_id ? parseInt(form.station_id) : null };
      if (!body.password) delete body.password;
      if (isEdit) await adminPut(`/staff/${data.id}`, body);
      else await adminPost('/staff', body);
      onSave(); onClose();
    } catch { setError('บันทึกไม่สำเร็จ'); }
    setSaving(false);
  };

  const selectedStation = stations.find(st => st.id == form.station_id);
  const filteredStations = stations.filter(st => !stationSearch || st.name.toLowerCase().includes(stationSearch.toLowerCase()));

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
          <Text style={s.headerTitle}>{isEdit ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[s.saveText, saving && { opacity: 0.5 }]}>บันทึก</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
          {error ? <Text style={s.error}>{error}</Text> : null}

          <Text style={s.label}>ชื่อ-นามสกุล *</Text>
          <TextInput style={s.input} value={form.name} onChangeText={v => setForm({...form, name: v})} placeholder="ชื่อ-นามสกุล" />

          <Text style={s.label}>ชื่อผู้ใช้ *</Text>
          <TextInput style={s.input} value={form.username} onChangeText={v => setForm({...form, username: v})} autoCapitalize="none" placeholder="username" />

          <Text style={s.label}>รหัสผ่าน {isEdit ? '(เว้นว่างถ้าไม่เปลี่ยน)' : '*'}</Text>
          <TextInput style={s.input} value={form.password} onChangeText={v => setForm({...form, password: v})} secureTextEntry placeholder="รหัสผ่าน" />

          <Text style={s.label}>ประจำปั๊ม</Text>
          <TouchableOpacity style={s.input} onPress={() => setShowStations(true)}>
            <Text style={{ fontSize: 15, color: selectedStation ? colors.onSurface : colors.outlineVariant }}>
              {selectedStation ? selectedStation.name : 'เลือกปั๊ม...'}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      {/* Station Picker Modal */}
      <Modal visible={showStations} animationType="slide" onRequestClose={() => setShowStations(false)}>
        <View style={s.container}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => setShowStations(false)}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
            <Text style={s.headerTitle}>เลือกปั๊ม</Text>
            <TouchableOpacity onPress={() => { setForm({...form, station_id: ''}); setShowStations(false); }}>
              <Text style={[s.saveText, { color: colors.fuelEmpty }]}>ล้าง</Text>
            </TouchableOpacity>
          </View>
          <TextInput style={[s.input, { margin: spacing.md }]} placeholder="🔍 ค้นหาปั๊ม..." value={stationSearch} onChangeText={setStationSearch} />
          <FlatList
            data={filteredStations}
            keyExtractor={st => String(st.id)}
            renderItem={({ item: st }) => (
              <TouchableOpacity style={s.stationItem} onPress={() => { setForm({...form, station_id: st.id}); setShowStations(false); }}>
                <Text style={s.stationName}>{st.name}</Text>
                <Text style={s.stationSub}>{st.brand} · {st.province_name}</Text>
                {form.station_id == st.id && <Ionicons name="checkmark-circle" size={20} color={colors.admin} style={{ position: 'absolute', right: 16, top: 14 }} />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
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
  stationItem: { paddingVertical: 14, paddingHorizontal: spacing.lg, borderBottomWidth: 0.5, borderBottomColor: colors.surfaceLow },
  stationName: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  stationSub: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 2 },
});
