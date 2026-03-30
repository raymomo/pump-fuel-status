import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminPost } from '../../utils/api';
import { colors, spacing, radius } from '../../styles/theme';

export default function FuelTypeFormModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name) return;
    setSaving(true);
    await adminPost('/fuel-types', { name, sort_order: parseInt(sortOrder) || 0 });
    onSave(); onClose();
    setSaving(false);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
          <Text style={s.headerTitle}>เพิ่มชนิดน้ำมัน</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[s.saveText, saving && { opacity: 0.5 }]}>บันทึก</Text>
          </TouchableOpacity>
        </View>
        <View style={s.body}>
          <Text style={s.label}>ชื่อชนิดน้ำมัน *</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="เช่น ดีเซล B7, E85" />
          <Text style={s.label}>ลำดับการแสดง</Text>
          <TextInput style={s.input} value={sortOrder} onChangeText={setSortOrder} keyboardType="numeric" placeholder="0" />
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
});
