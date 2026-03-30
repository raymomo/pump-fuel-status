import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminPost } from '../../utils/api';
import { colors, spacing, radius } from '../../styles/theme';

export default function AdminFormModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', username: '', password: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.username || !form.password) { setError('กรุณากรอกข้อมูลให้ครบ'); return; }
    if (form.password.length < 4) { setError('รหัสผ่านอย่างน้อย 4 ตัวอักษร'); return; }
    if (form.password !== form.confirm) { setError('รหัสผ่านไม่ตรงกัน'); return; }
    setSaving(true); setError('');
    await adminPost('/admins', { name: form.name, username: form.username, password: form.password });
    onSave(); onClose();
    setSaving(false);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
          <Text style={s.headerTitle}>เพิ่มผู้ดูแล</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[s.saveText, saving && { opacity: 0.5 }]}>บันทึก</Text>
          </TouchableOpacity>
        </View>
        <View style={s.body}>
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Text style={s.label}>ชื่อ-นามสกุล</Text>
          <TextInput style={s.input} value={form.name} onChangeText={v => setForm({...form, name: v})} placeholder="ชื่อ" />
          <Text style={s.label}>ชื่อผู้ใช้ *</Text>
          <TextInput style={s.input} value={form.username} onChangeText={v => setForm({...form, username: v})} autoCapitalize="none" placeholder="username" />
          <Text style={s.label}>รหัสผ่าน *</Text>
          <TextInput style={s.input} value={form.password} onChangeText={v => setForm({...form, password: v})} secureTextEntry placeholder="อย่างน้อย 4 ตัว" />
          <Text style={s.label}>ยืนยันรหัสผ่าน *</Text>
          <TextInput style={s.input} value={form.confirm} onChangeText={v => setForm({...form, confirm: v})} secureTextEntry placeholder="ยืนยันรหัสผ่าน" />
        </View>
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
});
