import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '../utils/storage';
import { colors, spacing, radius, shadows } from '../styles/theme';

export default function MenuScreen({ navigation }) {
  const [staffData, setStaffData] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [publicName, setPublicName] = useState(null);

  useEffect(() => {
    storage.get('staff').then(setStaffData);
    storage.get('admin').then(setAdminData);
    AsyncStorage.getItem('public_token').then(t => {
      if (t) {
        try {
          const payload = JSON.parse(atob(t.split('.')[1]));
          setPublicName(payload.name);
        } catch {}
      }
    });
  }, []);

  const logoutPublic = () => {
    Alert.alert('ออกจากระบบ', 'ต้องการออกจากระบบ LINE?', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ออกจากระบบ', style: 'destructive', onPress: async () => {
        await AsyncStorage.removeItem('public_token');
        setPublicName(null);
        Alert.alert('สำเร็จ', 'ออกจากระบบแล้ว');
      }},
    ]);
  };

  const goStaff = () => {
    if (staffData?.token) {
      navigation.navigate('StaffDashboard');
    } else {
      navigation.navigate('StaffLogin');
    }
  };

  const goAdmin = () => {
    if (adminData?.token) {
      navigation.navigate('AdminDashboard');
    } else {
      navigation.navigate('AdminLogin');
    }
  };

  const items = [
    { icon: 'person-outline', label: 'พนักงาน', sub: staffData?.name ? `เข้าสู่ระบบแล้ว: ${staffData.name}` : 'เข้าสู่ระบบ / สมัครพนักงาน', onPress: goStaff, color: colors.staffGreen, loggedIn: !!staffData?.token },
    { icon: 'shield-outline', label: 'ผู้ดูแลระบบ', sub: adminData?.token ? 'เข้าสู่ระบบแล้ว' : 'เข้าสู่ระบบ Admin', onPress: goAdmin, color: colors.admin, loggedIn: !!adminData?.token },
  ];

  return (
    <View style={styles.container}>
      {/* Public User Profile */}
      <View style={styles.profileCard}>
        <View style={[styles.profileAvatar, { backgroundColor: publicName ? '#06c755' : '#e5e7eb' }]}>
          <Ionicons name={publicName ? 'person' : 'person-outline'} size={28} color={publicName ? '#fff' : '#999'} />
        </View>
        <View style={{ flex: 1 }}>
          {publicName ? (
            <>
              <Text style={styles.profileName}>{publicName}</Text>
              <Text style={styles.profileSub}>เข้าสู่ระบบด้วย LINE</Text>
            </>
          ) : (
            <>
              <Text style={styles.profileName}>ยังไม่ได้เข้าสู่ระบบ</Text>
              <Text style={styles.profileSub}>กดปุ่ม + รายงาน เพื่อ login ด้วย LINE</Text>
            </>
          )}
        </View>
        {publicName && (
          <TouchableOpacity onPress={logoutPublic} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '600' }}>ออก</Text>
          </TouchableOpacity>
        )}
      </View>

      {items.map((item, i) => (
        <TouchableOpacity key={i} style={styles.card} onPress={item.onPress} activeOpacity={0.7}>
          <View style={[styles.iconWrap, { backgroundColor: item.color + '18' }]}>
            <Ionicons name={item.icon} size={24} color={item.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={[styles.sub, item.loggedIn && { color: item.color }]}>{item.sub}</Text>
          </View>
          {item.loggedIn && <View style={[styles.dot, { backgroundColor: item.color }]} />}
          <Ionicons name="chevron-forward" size={20} color={colors.outlineVariant} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, ...shadows.soft },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  sub: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, ...shadows.soft, marginBottom: spacing.sm, borderWidth: 1, borderColor: '#e5e7eb' },
  profileAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  profileName: { fontSize: 17, fontWeight: '800', color: colors.onSurface },
  profileSub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
  logoutBtn: { alignItems: 'center', gap: 2, padding: 8 },
});
