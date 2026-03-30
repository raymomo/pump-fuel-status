import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, RefreshControl, StatusBar, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { adminGet, adminPut, adminDelete, getProvinces } from '../../utils/api';
import { storage } from '../../utils/storage';
import { colors, spacing, radius, shadows } from '../../styles/theme';

import StationCard from './StationCard';
import StaffCard from './StaffCard';
import RequestCard from './RequestCard';
import FuelTypeCard from './FuelTypeCard';
import BrandCard from './BrandCard';
import AdminCard from './AdminCard';
import AuditCard from './AuditCard';
import StationFormModal from './StationFormModal';
import StaffFormModal from './StaffFormModal';
import FuelTypeFormModal from './FuelTypeFormModal';
import BrandFormModal from './BrandFormModal';
import AdminFormModal from './AdminFormModal';

const TABS = [
  { key: 'stations', label: 'ปั๊ม', icon: 'business', color: '#0891b2' },
  { key: 'staff', label: 'พนักงาน', icon: 'people', color: '#059669' },
  { key: 'brands', label: 'แบรนด์', icon: 'pricetag', color: '#ea580c' },
  { key: 'requests', label: 'คำขอ', icon: 'mail', color: '#d97706' },
  { key: 'fuels', label: 'น้ำมัน', icon: 'water', color: '#e11d48' },
  { key: 'admins', label: 'ผู้ดูแล', icon: 'shield', color: '#7c3aed' },
  { key: 'audit', label: 'Log', icon: 'document-text', color: '#6b7280' },
  { key: 'settings', label: 'ตั้งค่า', icon: 'settings', color: '#374151' },
];

export default function AdminDashboardScreen({ navigation }) {
  const [admin, setAdmin] = useState(null);
  const [tab, setTab] = useState('stations');
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [filterProvince, setFilterProvince] = useState('');
  const [filterBrand, setFilterBrand] = useState('');

  const [stations, setStations] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [fuelTypes, setFuelTypes] = useState([]);
  const [brands, setBrands] = useState([]);
  const [requests, setRequests] = useState([]);
  const [joinReqs, setJoinReqs] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [auditLogs, setAuditLogs] = useState({ logs: [], total: 0, page: 1, totalPages: 1 });
  const [auditPage, setAuditPage] = useState(1);
  const [settings, setSettings] = useState([]);

  useEffect(() => { loadAdmin(); }, []);

  const loadAdmin = async () => {
    const data = await storage.get('admin');
    if (!data?.token) { navigation.replace('AdminLogin'); return; }
    setAdmin(data);
    loadAll();
  };

  const loadAll = async () => {
    try {
      const [st, sf, pv, ft, br, req, jr, ad] = await Promise.all([
        adminGet('/stations'), adminGet('/staff'), getProvinces(),
        adminGet('/fuel-types'), adminGet('/brands'),
        adminGet('/station-requests'),
        adminGet('/join-requests'), adminGet('/admins'),
      ]);
      setStations(Array.isArray(st) ? st : []);
      setStaffList(Array.isArray(sf) ? sf : []);
      setProvinces(Array.isArray(pv) ? pv : []);
      setFuelTypes(Array.isArray(ft) ? ft : []);
      setBrands(Array.isArray(br) ? br : []);
      setRequests(Array.isArray(req) ? req : []);
      setJoinReqs(Array.isArray(jr) ? jr : []);
      setAdmins(Array.isArray(ad) ? ad : []);
    } catch {}
    loadAudit(1);
  };

  const loadAudit = async (p) => {
    try {
      const data = await adminGet(`/audit-logs?page=${p}&limit=20`);
      if (data?.logs) { setAuditLogs(data); setAuditPage(p); }
    } catch {}
  };

  const loadSettings = async () => {
    try {
      const data = await adminGet('/settings');
      if (Array.isArray(data)) setSettings(data);
    } catch {}
  };

  const toggleSetting = async (key) => {
    const current = settings.find(s => s.key === key);
    const newValue = current?.value === 'true' ? 'false' : 'true';
    await adminPut(`/settings/${key}`, { value: newValue, admin_name: admin?.name });
    loadSettings();
  };

  const onRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); };

  const handleLogout = () => {
    Alert.alert('ออกจากระบบ', 'ต้องการออกจากระบบ?', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ออก', style: 'destructive', onPress: async () => { await storage.remove('admin'); navigation.replace('AdminLogin'); } },
    ]);
  };

  const deleteItem = (type, id, name) => {
    Alert.alert('ยืนยันลบ', `ลบ "${name}" ?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: async () => { await adminDelete(`/${type}/${id}`); loadAll(); } },
    ]);
  };

  const approveRequest = async (type, id) => { await adminPut(`/${type}/${id}/approve`, {}); loadAll(); };

  const rejectRequest = async (type, id) => { await adminPut(`/${type}/${id}/reject`, { admin_note: 'ปฏิเสธ' }); loadAll(); };

  const pendingCount = requests.filter(r => r.status === 'pending').length + joinReqs.filter(r => r.status === 'pending').length;

  if (!admin) return <View style={s.center}><Text style={{ color: colors.onSurfaceVariant }}>กำลังโหลด...</Text></View>;

  const q = search.toLowerCase();
  const stationBrands = [...new Set(stations.map(st => st.brand).filter(Boolean))].sort();
  const listData =
    tab === 'stations' ? stations.filter(st => {
      if (q && !st.name.toLowerCase().includes(q) && !st.brand?.toLowerCase().includes(q) && !st.province_name?.toLowerCase().includes(q)) return false;
      if (filterProvince && st.province_id !== parseInt(filterProvince)) return false;
      if (filterBrand && st.brand !== filterBrand) return false;
      return true;
    }) :
    tab === 'staff' ? staffList.filter(st => !q || st.name.toLowerCase().includes(q) || st.username?.toLowerCase().includes(q)) :
    tab === 'brands' ? brands :
    tab === 'requests' ? [...joinReqs, ...requests] :
    tab === 'fuels' ? fuelTypes :
    tab === 'admins' ? admins :
    tab === 'audit' ? (auditLogs.logs || []) :
    tab === 'settings' ? settings : [];

  const insets = useSafeAreaInsets();
  const activeTab = TABS.find(t => t.key === tab);
  const tabColor = activeTab?.color || colors.admin;

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={tabColor} />
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + spacing.md, backgroundColor: tabColor }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>สวัสดี, {admin.name || 'Admin'}</Text>
          <Text style={s.headerSub}>{stations.length} ปั๊ม · {staffList.length} พนักงาน</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[s.tabItem, tab === t.key && { backgroundColor: t.color }]} onPress={() => { setTab(t.key); setSearch(''); setFilterProvince(''); setFilterBrand(''); if (t.key === 'settings') loadSettings(); if (t.key === 'audit') loadAudit(1); }}>
            <Ionicons name={t.icon} size={18} color={tab === t.key ? '#fff' : t.color} />
            <Text style={[s.tabText, { color: t.color }, tab === t.key && s.tabTextActive]}>{t.label}</Text>
            {t.key === 'requests' && pendingCount > 0 && (
              <View style={s.badge}><Text style={s.badgeText}>{pendingCount}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      {['stations', 'staff'].includes(tab) && (
        <View style={s.searchRow}>
          <Ionicons name="search" size={16} color={colors.outlineVariant} />
          <TextInput style={s.searchInput} placeholder="ค้นหา..." value={search} onChangeText={setSearch} placeholderTextColor={colors.outlineVariant} />
        </View>
      )}

      {/* Filters - จังหวัด & แบรนด์ */}
      {tab === 'stations' && (
        <View style={s.filterRow}>
          <TouchableOpacity style={[s.filterBtn, filterProvince && { borderColor: tabColor, backgroundColor: tabColor + '15' }]} onPress={() => setModal({ type: 'pickProvince' })}>
            <Ionicons name="location-outline" size={14} color={filterProvince ? tabColor : colors.onSurfaceVariant} />
            <Text style={[s.filterBtnText, filterProvince && { color: tabColor }]} numberOfLines={1}>
              {filterProvince ? provinces.find(p => String(p.id) === filterProvince)?.name : 'จังหวัด'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={filterProvince ? tabColor : colors.onSurfaceVariant} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.filterBtn, filterBrand && { borderColor: tabColor, backgroundColor: tabColor + '15' }]} onPress={() => setModal({ type: 'pickBrand' })}>
            <Ionicons name="pricetag-outline" size={14} color={filterBrand ? tabColor : colors.onSurfaceVariant} />
            <Text style={[s.filterBtnText, filterBrand && { color: tabColor }]} numberOfLines={1}>
              {filterBrand || 'แบรนด์'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={filterBrand ? tabColor : colors.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={s.filterCount}>{listData.length}</Text>
        </View>
      )}

      {/* Province Picker */}
      {modal?.type === 'pickProvince' && (
        <PickerModal
          title="เลือกจังหวัด"
          data={[{ id: '', name: 'ทุกจังหวัด' }, ...provinces]}
          selected={filterProvince}
          onSelect={(id) => { setFilterProvince(String(id)); setModal(null); }}
          onClose={() => setModal(null)}
          color={tabColor}
        />
      )}

      {/* Brand Picker */}
      {modal?.type === 'pickBrand' && (
        <PickerModal
          title="เลือกแบรนด์"
          data={[{ id: '', name: 'ทุกแบรนด์' }, ...stationBrands.map(b => ({ id: b, name: b }))]}
          selected={filterBrand}
          onSelect={(id) => { setFilterBrand(String(id)); setModal(null); }}
          onClose={() => setModal(null)}
          color={tabColor}
        />
      )}

      {/* List */}
      <FlatList
        data={listData}
        keyExtractor={(item, i) => `${tab}-${item.id || i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[tabColor]} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
        ListEmptyComponent={<Text style={s.empty}>ไม่มีข้อมูล</Text>}
        ListHeaderComponent={null}
        ListFooterComponent={
          tab === 'audit' && auditLogs.totalPages > 1 ? (
            <View style={s.pageRow}>
              <TouchableOpacity disabled={auditPage <= 1} onPress={() => loadAudit(auditPage - 1)} style={[s.pageBtn, { backgroundColor: tabColor }, auditPage <= 1 && { opacity: 0.3 }]}>
                <Text style={s.pageBtnText}>← ก่อนหน้า</Text>
              </TouchableOpacity>
              <Text style={s.pageInfo}>{auditPage}/{auditLogs.totalPages}</Text>
              <TouchableOpacity disabled={auditPage >= auditLogs.totalPages} onPress={() => loadAudit(auditPage + 1)} style={[s.pageBtn, { backgroundColor: tabColor }, auditPage >= auditLogs.totalPages && { opacity: 0.3 }]}>
                <Text style={s.pageBtnText}>ถัดไป →</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          if (tab === 'stations') return <StationCard item={item} onEdit={() => setModal({ type: 'station', data: item })} onDelete={() => deleteItem('stations', item.id, item.name)} />;
          if (tab === 'staff') return <StaffCard item={item} stations={stations} onEdit={() => setModal({ type: 'staff', data: item })} onDelete={() => deleteItem('staff', item.id, item.name)} />;
          if (tab === 'requests') return <RequestCard item={item} onApprove={approveRequest} onReject={rejectRequest} />;
          if (tab === 'brands') return <BrandCard item={item} onEdit={() => setModal({ type: 'brand', data: item })} onDelete={() => deleteItem('brands', item.id, item.name)} />;
          if (tab === 'fuels') return <FuelTypeCard item={item} onDelete={() => deleteItem('fuel-types', item.id, item.name)} />;
          if (tab === 'admins') return <AdminCard item={item} onDelete={() => deleteItem('admins', item.id, item.username)} />;
          if (tab === 'audit') return <AuditCard item={item} />;
          if (tab === 'settings') return (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: '#fff', borderRadius: 12, marginBottom: 8, marginHorizontal: 16, ...shadows.soft }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontWeight: '700', fontSize: 14, color: '#1a1a1a' }}>
                  {item.key === 'public_reporting_enabled' ? '📢 ระบบรายงานจากประชาชน' : item.key}
                </Text>
                <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                  {item.key === 'public_reporting_enabled' ? 'เปิดให้ประชาชน login ด้วย LINE แล้วรายงานสถานะน้ำมัน' : item.key}
                </Text>
                {item.updated_by && <Text style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>แก้ไขล่าสุดโดย: {item.updated_by}</Text>}
              </View>
              <TouchableOpacity
                onPress={() => toggleSetting(item.key)}
                style={{ width: 52, height: 28, borderRadius: 14, backgroundColor: item.value === 'true' ? '#4ade80' : '#d1d5db', justifyContent: 'center', padding: 3 }}
              >
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: item.value === 'true' ? 'flex-end' : 'flex-start', ...shadows.soft }} />
              </TouchableOpacity>
            </View>
          );
          return null;
        }}
      />

      {/* FAB - ปุ่มเพิ่ม */}
      {['stations', 'staff', 'brands', 'fuels', 'admins'].includes(tab) && (
        <TouchableOpacity style={[s.fab, { backgroundColor: tabColor }]} onPress={() => {
          if (tab === 'stations') setModal({ type: 'station' });
          else if (tab === 'staff') setModal({ type: 'staff' });
          else if (tab === 'brands') setModal({ type: 'brand' });
          else if (tab === 'fuels') setModal({ type: 'fueltype' });
          else if (tab === 'admins') setModal({ type: 'admin' });
        }}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modals */}
      {modal?.type === 'station' && <StationFormModal data={modal.data} provinces={provinces} fuelTypes={fuelTypes} staffList={staffList} brands={brands} onClose={() => setModal(null)} onSave={loadAll} onEdit={(created) => setModal({ type: 'station', data: created })} />}
      {modal?.type === 'staff' && <StaffFormModal data={modal.data} stations={stations} onClose={() => setModal(null)} onSave={loadAll} />}
      {modal?.type === 'brand' && <BrandFormModal data={modal.data} onClose={() => setModal(null)} onSave={loadAll} />}
      {modal?.type === 'fueltype' && <FuelTypeFormModal onClose={() => setModal(null)} onSave={loadAll} />}
      {modal?.type === 'admin' && <AdminFormModal onClose={() => setModal(null)} onSave={loadAll} />}
    </View>
  );
}

function PickerModal({ title, data, selected, onSelect, onClose, color }) {
  const [search, setSearch] = useState('');
  const filtered = data.filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: colors.surfaceLow }}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: colors.onSurface, textAlign: 'center' }}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>
        <TextInput
          style={{ margin: spacing.md, padding: 12, borderWidth: 1.5, borderColor: colors.surfaceVariant, borderRadius: radius.md, fontSize: 14, backgroundColor: colors.surfaceLow }}
          placeholder="🔍 ค้นหา..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={colors.outlineVariant}
        />
        <FlatList
          data={filtered}
          keyExtractor={d => String(d.id)}
          renderItem={({ item: d }) => {
            const isActive = String(d.id) === String(selected);
            return (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.lg, borderBottomWidth: 0.5, borderBottomColor: colors.surfaceLow, backgroundColor: isActive ? color + '10' : '#fff' }}
                onPress={() => onSelect(d.id)}
              >
                <Text style={{ flex: 1, fontSize: 15, color: isActive ? color : colors.onSurface, fontWeight: isActive ? '700' : '400' }}>{d.name}</Text>
                {isActive && <Ionicons name="checkmark-circle" size={20} color={color} />}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { backgroundColor: colors.admin, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, flexDirection: 'row', alignItems: 'center' },
  greeting: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.surfaceLow, paddingVertical: 6, paddingHorizontal: 4 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 6, marginHorizontal: 1, borderRadius: radius.md, gap: 2 },
  tabText: { fontSize: 10, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  badge: { backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginTop: spacing.sm, backgroundColor: '#fff', borderRadius: radius.lg, paddingHorizontal: spacing.md, ...shadows.soft },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14 },
  filterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 6, gap: 8 },
  filterBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.surfaceVariant },
  filterBtnText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  filterCount: { fontSize: 13, fontWeight: '700', color: colors.onSurfaceVariant, minWidth: 28, textAlign: 'center' },

  empty: { textAlign: 'center', color: colors.onSurfaceVariant, padding: 40, fontSize: 15 },

  pageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, gap: spacing.md },
  pageBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.admin, borderRadius: radius.md },
  pageBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  pageInfo: { fontSize: 14, fontWeight: '600', color: colors.onSurfaceVariant },

  fab: { position: 'absolute', bottom: 80, alignSelf: 'center', left: '50%', marginLeft: -28, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.admin, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5 },
});
