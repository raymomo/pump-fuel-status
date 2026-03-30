import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { DOMAIN, adminPost, adminPut } from '../../utils/api';
import { storage } from '../../utils/storage';
import { colors, spacing, radius } from '../../styles/theme';

const PRESET_COLORS = ['#e65100', '#ad1457', '#2e7d32', '#f57f17', '#bf360c', '#1565c0', '#283593', '#00695c', '#6a1b9a', '#0d47a1', '#1a237e', '#616161'];

export default function BrandFormModal({ data, onClose, onSave }) {
  const isEdit = !!data;
  const [form, setForm] = useState({
    name: data?.name || '',
    logo_url: data?.logo_url || '',
    color: data?.color || '#e65100',
    sort_order: data?.sort_order != null ? String(data.sort_order) : '0',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;
    setUploading(true);
    try {
      const uri = result.assets[0].uri;
      const ext = uri.split('.').pop().toLowerCase();
      const admin = await storage.get('admin');
      const fd = new FormData();
      fd.append('file', { uri, name: `brand.${ext}`, type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
      const res = await fetch('${DOMAIN}/api/admin/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${admin?.token}` },
        body: fd,
      });
      const d = await res.json();
      if (d.url) setForm({...form, logo_url: d.url});
      else setError(d.error || 'อัปโหลดไม่สำเร็จ');
    } catch { setError('อัปโหลดไม่สำเร็จ'); }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.name) { setError('กรุณากรอกชื่อแบรนด์'); return; }
    setSaving(true); setError('');
    try {
      const body = { ...form, sort_order: parseInt(form.sort_order) || 0 };
      if (isEdit) await adminPut(`/brands/${data.id}`, body);
      else await adminPost('/brands', body);
      onSave(); onClose();
    } catch { setError('บันทึกไม่สำเร็จ'); }
    setSaving(false);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
          <Text style={s.headerTitle}>{isEdit ? 'แก้ไขแบรนด์' : 'เพิ่มแบรนด์'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[s.saveText, saving && { opacity: 0.5 }]}>บันทึก</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
          {error ? <Text style={s.error}>{error}</Text> : null}

          <Text style={s.label}>ชื่อแบรนด์ *</Text>
          <TextInput style={s.input} value={form.name} onChangeText={v => setForm({...form, name: v})} placeholder="เช่น PTT, Shell" />

          <Text style={s.label}>โลโก้</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
            <TouchableOpacity style={s.uploadBtn} onPress={handleUpload} disabled={uploading}>
              <Ionicons name="cloud-upload" size={18} color="#fff" />
              <Text style={s.uploadBtnText}>{uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดรูป'}</Text>
            </TouchableOpacity>
            {form.logo_url ? (
              <TouchableOpacity onPress={() => setForm({...form, logo_url: ''})} style={s.removeBtn}>
                <Ionicons name="close-circle" size={20} color={colors.fuelEmpty} />
              </TouchableOpacity>
            ) : null}
          </View>
          {form.logo_url ? (
            <View style={s.previewRow}>
              <Image source={{ uri: form.logo_url }} style={s.previewImg} resizeMode="contain" />
              <Text style={s.previewText}>✓ อัปโหลดแล้ว</Text>
            </View>
          ) : null}

          <Text style={s.label}>สีแบรนด์</Text>
          <View style={s.colorGrid}>
            {PRESET_COLORS.map(c => (
              <TouchableOpacity key={c} style={[s.colorBtn, { backgroundColor: c }, form.color === c && s.colorBtnActive]} onPress={() => setForm({...form, color: c})}>
                {form.color === c && <Ionicons name="checkmark" size={16} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={s.input} value={form.color} onChangeText={v => setForm({...form, color: v})} placeholder="#e65100" />

          <Text style={s.label}>ลำดับการแสดง</Text>
          <TextInput style={s.input} value={form.sort_order} onChangeText={v => setForm({...form, sort_order: v})} keyboardType="numeric" placeholder="0" />

          <View style={{ height: 60 }} />
        </ScrollView>
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
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.admin, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  removeBtn: { justifyContent: 'center', paddingHorizontal: 4 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  previewImg: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.surfaceLow },
  previewText: { fontSize: 12, color: colors.fuelAvailable, fontWeight: '600' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  colorBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  colorBtnActive: { borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 4 },
});
