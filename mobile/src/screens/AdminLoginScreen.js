import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminLogin } from '../utils/api';
import { storage } from '../utils/storage';
import { colors, spacing, radius, shadows } from '../styles/theme';

export default function AdminLoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) { setError('กรุณากรอกข้อมูลให้ครบ'); return; }
    setError(''); setLoading(true);
    try {
      const { ok, data } = await adminLogin(username, password);
      if (!ok) { setError(data.error || 'เข้าสู่ระบบไม่สำเร็จ'); setLoading(false); return; }
      await storage.set('admin', data);
      navigation.replace('AdminDashboard');
    } catch { setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'); }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark" size={60} color={colors.admin} />
        </View>
        <Text style={styles.title}>เข้าสู่ระบบผู้ดูแล</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>ชื่อผู้ใช้</Text>
        <TextInput style={styles.input} placeholder="admin" value={username} onChangeText={setUsername} autoCapitalize="none" />

        <Text style={styles.label}>รหัสผ่าน</Text>
        <View style={styles.passWrap}>
          <TextInput style={styles.passInput} placeholder="รหัสผ่าน" value={password} onChangeText={setPassword} secureTextEntry={!showPass} />
          <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.passEye}>
            <Ionicons name={showPass ? 'eye-off' : 'eye'} size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={handleLogin} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'กำลังดำเนินการ...' : 'เข้าสู่ระบบ'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.admin, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.xxl, width: '100%', maxWidth: 400, ...shadows.ambient },
  iconWrap: { alignItems: 'center', marginBottom: spacing.sm },
  title: { fontSize: 20, fontWeight: '800', color: colors.onSurface, textAlign: 'center', marginBottom: spacing.lg },

  errorBox: { backgroundColor: colors.fuelEmptyBg, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  errorText: { color: colors.fuelEmpty, fontSize: 13, textAlign: 'center', fontWeight: '500' },

  label: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant, marginBottom: 4, marginTop: spacing.sm },
  input: { width: '100%', padding: 14, borderWidth: 1.5, borderColor: colors.surfaceVariant, borderRadius: radius.md, fontSize: 15, backgroundColor: colors.surfaceLow },
  passWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.surfaceVariant, borderRadius: radius.md, backgroundColor: colors.surfaceLow },
  passInput: { flex: 1, padding: 14, fontSize: 15 },
  passEye: { padding: 12 },

  btn: { width: '100%', backgroundColor: colors.admin, padding: 16, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.lg },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
