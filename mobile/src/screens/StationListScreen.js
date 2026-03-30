import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Animated, StatusBar, Platform, Linking, Image, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapLibreMap from '../components/MapLibreMap';
import * as Location from 'expo-location';
import { DOMAIN, getStationsStatus, getStationsDots, getProvinces, getStation, getLineLoginUrl, submitPublicReport } from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LineLogin from '@xmartlabs/react-native-line';
import { getDistance, timeAgo } from '../utils/helpers';
import { colors, spacing, radius as rad, shadows, brandColors } from '../styles/theme';
import { provinceCoords } from '../utils/provinceCoords';
import socket from '../utils/socket';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function StationListScreen({ navigation }) {
  const [stations, setStations] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedBrand, setSelectedBrand] = useState([]);
  const [selectedFuelType, setSelectedFuelType] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [viewMode, setViewMode] = useState('all');
  const [displayMode, setDisplayMode] = useState('map');
  const [radiusKm, setRadiusKm] = useState(0);
  const [userLat, setUserLat] = useState(null);
  const [userLng, setUserLng] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showProvinces, setShowProvinces] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showRadius, setShowRadius] = useState(false);
  const [mapTheme, setMapTheme] = useState('light');
  const [showNavSettings, setShowNavSettings] = useState(false);
  const [navBrands, setNavBrands] = useState([]);
  const [navFuelTypes, setNavFuelTypes] = useState([]);
  const [nearestStation, setNearestStation] = useState(null);
  const [nearestDist, setNearestDist] = useState(0);
  const [showBrands, setShowBrands] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const [publicToken, setPublicToken] = useState(null);
  const [reportStation, setReportStation] = useState(null);
  const [reportFuelType, setReportFuelType] = useState('');
  const [reportAvailable, setReportAvailable] = useState(true);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportingEnabled, setReportingEnabled] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  // Setup LINE SDK + load public token + check reporting enabled
  useEffect(() => {
    LineLogin.setup({ channelId: '2009571255' });
    AsyncStorage.getItem('public_token').then(t => { if (t) setPublicToken(t); });
    fetch(`${DOMAIN}/api/feature/public_reporting_enabled`).then(r => r.json())
      .then(d => setReportingEnabled(!!d.enabled)).catch(() => {});
    const unsubscribe = navigation.addListener('focus', () => {
      AsyncStorage.getItem('public_token').then(t => setPublicToken(t || null));
    });
    return unsubscribe;
  }, [navigation]);

  const load = useCallback(async (bustCache = false) => {
    if (!selectedProvince) {
      // ไม่เลือกจังหวัด → โหลด dots เบาๆ
      const data = await getStationsDots();
      setStations(data);
    } else {
      // เลือกจังหวัด → โหลด full detail
      const data = await getStationsStatus(selectedProvince, bustCache);
      setStations(data);
    }
    setLoading(false);
  }, [selectedProvince]);

  const closeDropdowns = () => { setShowProvinces(false); setShowBrands(false); };

  useEffect(() => { getProvinces().then(setProvinces); locateUser(); }, []);

  // เปลี่ยน header ตาม theme
  useEffect(() => {
    const isDark = mapTheme === 'dark';
    navigation.setOptions({
      headerStyle: { backgroundColor: isDark ? '#1a1a2e' : colors.primary },
      headerTitleStyle: { fontWeight: '800', fontSize: 20, color: isDark ? '#4ade80' : '#fff' },
      headerTintColor: '#fff',
    });
  }, [mapTheme, navigation]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const handler = () => {
      // bypass cache เมื่อได้รับ socket update
      setTimeout(() => load(true), 500);
    };
    socket.on('fuel-updated', handler);
    // Fallback polling ทุก 30 วินาที กรณี socket ไม่ทำงาน
    const interval = setInterval(() => { if (!socket.connected) load(); }, 30000);
    return () => { socket.off('fuel-updated', handler); clearInterval(interval); };
  }, [load]);

  const locateUser = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({});
      setUserLat(loc.coords.latitude);
      setUserLng(loc.coords.longitude);
    }
  };

  const handleRadiusChange = (r) => {
    setRadiusKm(r);
  };

  const showStationCard = (s) => {
    setSelectedStation(s);
    Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }).start();
  };

  const hideStationCard = () => {
    Animated.timing(slideAnim, { toValue: 0, useNativeDriver: true, duration: 200 }).start(() => setSelectedStation(null));
  };

  const brands = [...new Set(stations.map(s => s.brand))].sort();

  const fuelTypesList = [...new Set(stations.flatMap(s => s.fuels?.map(f => f.fuel_type) || []))].sort();

  const filtered = stations.filter(s => {
    if (radiusKm > 0 && userLat && userLng && getDistance(userLat, userLng, s.lat, s.lng) > radiusKm) return false;
    if (selectedBrand.length > 0 && !selectedBrand.includes(s.brand)) return false;
    if (selectedFuelType.length > 0 && !selectedFuelType.some(ft => s.fuels?.some(f => f.fuel_type === ft && f.is_available))) return false;
    if (viewMode === 'available' && !s.has_fuel) return false;
    if (viewMode === 'empty' && s.has_fuel) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.address?.toLowerCase().includes(q) || s.brand.toLowerCase().includes(q);
    }
    return true;
  }).map(s => ({ ...s, _distance: userLat ? getDistance(userLat, userLng, s.lat, s.lng) : null }))
    .sort((a, b) => (a._distance ?? 999) - (b._distance ?? 999));

  const greenCount = filtered.filter(s => s.has_fuel).length;
  const redCount = filtered.filter(s => !s.has_fuel).length;

  const navigateToStation = (s) => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`);
  };

  const doLineLogin = async () => {
    try {
      const result = await LineLogin.login({ scopes: ['profile', 'openid'] });
      const accessToken = result?.accessToken?.accessToken;
      if (accessToken) {
        const res = await fetch(`${DOMAIN}/api/auth/line/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: accessToken }),
        });
        const data = await res.json();
        if (data.token) {
          await AsyncStorage.setItem('public_token', data.token);
          setPublicToken(data.token);
          Alert.alert('สำเร็จ', `เข้าสู่ระบบเป็น ${data.name}`);
        } else {
          Alert.alert('ผิดพลาด', data.error || 'ไม่สามารถเข้าสู่ระบบได้');
        }
      }
    } catch (e) {
      if (e.message?.includes('cancel')) return;
      Alert.alert('ผิดพลาด', e.message || 'ไม่สามารถเข้าสู่ระบบ LINE ได้');
    }
  };

  const [showLoginCard, setShowLoginCard] = useState(false);

  const openReportMode = async () => {
    if (!publicToken) {
      setShowLoginCard(true);
      return;
    }
    if (!userLat || !userLng) {
      Alert.alert('ไม่พบตำแหน่ง', 'กรุณาเปิด GPS ก่อน');
      locateUser();
      return;
    }
    const nearby = stations
      .map(s => ({ ...s, _dist: getDistance(userLat, userLng, s.lat, s.lng) * 1000 }))
      .filter(s => s._dist <= 500)
      .sort((a, b) => a._dist - b._dist);
    if (nearby.length === 0) {
      Alert.alert('ไม่พบปั๊ม', 'ไม่มีปั๊มในรัศมี 500 เมตร');
      return;
    }
    setReportStation(nearby[0]);
    setReportFuelType('');
    setReportAvailable(true);
    setShowReportModal(true);
  };

  const doSubmitReport = async () => {
    if (!reportStation || !reportFuelType) {
      Alert.alert('กรุณาเลือกชนิดน้ำมัน');
      return;
    }
    setReportSubmitting(true);
    const result = await submitPublicReport(publicToken, {
      station_id: reportStation.id,
      fuel_type: reportFuelType,
      is_available: reportAvailable,
      lat: userLat,
      lng: userLng,
    });
    setReportSubmitting(false);
    if (!result.ok) {
      if (result.data?.error?.includes('เข้าสู่ระบบ') || result.data?.error?.includes('Token')) {
        await AsyncStorage.removeItem('public_token');
        setPublicToken(null);
        Alert.alert('กรุณาเข้าสู่ระบบใหม่');
        setShowLineLogin(true);
        return;
      }
      Alert.alert('ผิดพลาด', result.data?.error || 'เกิดข้อผิดพลาด');
      return;
    }
    Alert.alert('สำเร็จ', `รายงานสำเร็จ! (${result.data.same_reports} คนรายงานเหมือนกัน)`);
    setShowReportModal(false);
  };

  const navigateToNearest = () => {
    if (!userLat || !userLng) {
      Alert.alert('ไม่พบตำแหน่ง', 'กรุณาเปิด GPS ก่อน');
      locateUser();
      return;
    }
    // หาปั๊มที่ตรงตาม preference
    const matching = stations.filter(s => {
      if (navBrands.length > 0 && !navBrands.includes(s.brand)) return false;
      if (navFuelTypes.length > 0 && !navFuelTypes.some(ft => s.fuels?.some(f => f.fuel_type === ft && f.is_available))) return false;
      if (!s.has_fuel) return false;
      return true;
    });
    if (matching.length === 0) {
      Alert.alert('ไม่พบปั๊ม', 'ไม่มีปั๊มที่ตรงตามเงื่อนไข ลองเปลี่ยนตั้งค่า');
      setShowNavSettings(true);
      return;
    }
    // หาใกล้สุด
    let nearest = matching[0];
    let minDist = getDistance(userLat, userLng, nearest.lat, nearest.lng);
    matching.forEach(s => {
      const d = getDistance(userLat, userLng, s.lat, s.lng);
      if (d < minDist) { minDist = d; nearest = s; }
    });
    setNearestStation(nearest);
    setNearestDist(minDist);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* ===== MAP VIEW ===== */}
      {displayMode === 'map' && (
        <View style={{ flex: 1 }}>
          <MapLibreMap
            stations={filtered}
            userLat={userLat}
            userLng={userLng}
            radiusKm={radiusKm}
            mapTheme={mapTheme}
            selectedProvinceName={provinces.find(p => String(p.id) === selectedProvince)?.name}
            onMarkerPress={(msg) => {
              setShowProvinces(false); setShowBrands(false);
              if (msg.type === 'mapClick') {
                setShowFilters(false);
                setShowRadius(false);
                return;
              }
              if (msg.type === 'marker') {
                let s = filtered.find(st => st.id === msg.id);
                if (s && !s.fuels) {
                  // dots mode → โหลด detail
                  getStation(msg.id).then(detail => { if (detail) showStationCard(detail); });
                } else if (s) {
                  showStationCard(s);
                }
              } else if (msg.type === 'detail') {
                navigation.navigate('StationDetail', { id: msg.id });
              } else if (msg.type === 'navigate') {
                Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${msg.lat},${msg.lng}`);
              }
            }}
          />

          {/* รัศมี slide ด้านขวา */}
          <TouchableOpacity style={[styles.radiusToggle, { backgroundColor: radiusKm > 0 ? colors.primary : '#fff' }]} onPress={() => setShowRadius(!showRadius)}>
            <Ionicons name="locate-outline" size={16} color={radiusKm > 0 ? '#fff' : colors.primary} />
            {radiusKm > 0 && <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>{radiusKm}</Text>}
          </TouchableOpacity>
          {showRadius && (
            <View style={styles.radiusSlide}>
              {[0, 5, 10, 20, 50].map(r => (
                <TouchableOpacity key={r} style={[styles.radiusSlideBtn, radiusKm === r && r > 0 && styles.radiusSlideBtnActive]} onPress={() => { handleRadiusChange(r); setShowRadius(false); }}>
                  <Text style={[styles.radiusSlideText, radiusKm === r && r > 0 && styles.radiusSlideTextActive]}>{r === 0 ? '∞' : r}</Text>
                </TouchableOpacity>
              ))}
              <Text style={styles.radiusSlideLabel}>กม.</Text>
            </View>
          )}

          {/* ปุ่มสลับ map theme */}
          <TouchableOpacity style={[styles.themeToggle]} onPress={() => setMapTheme(mapTheme === 'dark' ? 'light' : 'dark')}>
            <Ionicons name={mapTheme === 'dark' ? 'sunny' : 'moon'} size={16} color={mapTheme === 'dark' ? '#fbbf24' : '#6366f1'} />
          </TouchableOpacity>

          {/* Dismiss overlay for dropdowns */}
          {(showProvinces || showBrands) && (
            <TouchableOpacity style={[StyleSheet.absoluteFill, { zIndex: 9 }]} activeOpacity={1} onPress={() => { setShowProvinces(false); setShowBrands(false); }} />
          )}

          {/* Top bar - fuel types + filter button */}
          <View style={styles.floatingTopBar}>
            {/* ชนิดน้ำมัน (แสดงเสมอ) */}
            <View style={styles.topBarRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} fadingEdgeLength={30}>
                {fuelTypesList.map(ft => (
                  <TouchableOpacity key={ft} style={[styles.topChip, selectedFuelType.includes(ft) && styles.topChipActive]} onPress={() => setSelectedFuelType(selectedFuelType.includes(ft) ? selectedFuelType.filter(x => x !== ft) : [...selectedFuelType, ft])}>
                    <Text style={[styles.topChipText, selectedFuelType.includes(ft) && styles.topChipTextActive]}>{ft}</Text>
                  </TouchableOpacity>
                ))}
                <View style={{ width: 20 }} />
              </ScrollView>
              <View style={styles.scrollHint}><Text style={{ fontSize: 10, color: '#0d9488', fontWeight: '700' }}>เลื่อน →</Text></View>
              <TouchableOpacity style={styles.filterIconBtn} onPress={() => setShowFilters(!showFilters)}>
                <Ionicons name="options" size={18} color="#fff" />
                {(selectedProvince || selectedBrand.length > 0 || viewMode !== 'all' || radiusKm > 0) && (
                  <View style={styles.filterDot} />
                )}
              </TouchableOpacity>
            </View>


            {/* Brand chips (แสดงเสมอ) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
              {brands.map(b => (
                <TouchableOpacity key={b} style={[styles.topChip, selectedBrand.includes(b) && { backgroundColor: '#f59e0b' }]} onPress={() => setSelectedBrand(selectedBrand.includes(b) ? selectedBrand.filter(x => x !== b) : [...selectedBrand, b])}>
                  <Text style={[styles.topChipText, selectedBrand.includes(b) && { color: '#fff' }]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Filter panel (show/hide) */}
          {showFilters && (
            <View style={styles.filterPanel}>
              {/* จังหวัด */}
              <Text style={styles.filterLabel}>📍 จังหวัด</Text>
              <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <TouchableOpacity style={[styles.filterChipBtn, !selectedProvince && { backgroundColor: colors.primary + '15', borderColor: colors.primary }]} onPress={() => setSelectedProvince('')}>
                    <Text style={[styles.filterChipBtnText, !selectedProvince && { color: colors.primary }]}>ทั้งหมด</Text>
                  </TouchableOpacity>
                  {provinces.map(p => (
                    <TouchableOpacity key={p.id} style={[styles.filterChipBtn, selectedProvince === String(p.id) && { backgroundColor: colors.primary + '15', borderColor: colors.primary }]} onPress={() => setSelectedProvince(selectedProvince === String(p.id) ? '' : String(p.id))}>
                      <Text style={[styles.filterChipBtnText, selectedProvince === String(p.id) && { color: colors.primary }]}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* แบรนด์ (multi-select) */}
              <Text style={styles.filterLabel}>⛽ แบรนด์</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {brands.map(b => (
                  <TouchableOpacity key={b} style={[styles.filterChipBtn, selectedBrand.includes(b) && { backgroundColor: '#fff3e0', borderColor: '#e65100' }]} onPress={() => {
                    setSelectedBrand(selectedBrand.includes(b) ? selectedBrand.filter(x => x !== b) : [...selectedBrand, b]);
                  }}>
                    <Text style={[styles.filterChipBtnText, selectedBrand.includes(b) && { color: '#e65100' }]}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* สถานะ + รัศมี */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.filterChipBtn, viewMode === 'available' && { backgroundColor: colors.fuelAvailableBg, borderColor: colors.fuelAvailable }]}
                  onPress={() => setViewMode(viewMode === 'available' ? 'all' : 'available')}
                >
                  <Text style={[styles.filterChipBtnText, viewMode === 'available' && { color: colors.fuelAvailable }]}>
                    {viewMode === 'available' ? '🟢 แสดงเฉพาะปั๊มที่มีน้ำมัน' : '🟢 ซ่อนปั๊มที่หมด'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* รัศมี */}
              <Text style={[styles.filterLabel, { marginTop: 8 }]}>📏 รัศมี</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[0, 5, 10, 20, 50].map(r => (
                  <TouchableOpacity key={r} style={[styles.filterChipBtn, radiusKm === r && { backgroundColor: colors.primary + '15', borderColor: colors.primary }]} onPress={() => handleRadiusChange(r)}>
                    <Text style={[styles.filterChipBtnText, radiusKm === r && { color: colors.primary }]}>{r === 0 ? 'ทั้งหมด' : `${r} กม.`}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ชนิดน้ำมัน */}
              <Text style={[styles.filterLabel, { marginTop: 8 }]}>🛢️ ชนิดน้ำมัน</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <TouchableOpacity style={[styles.filterChipBtn, selectedFuelType.length === 0 && { backgroundColor: colors.primary + '15', borderColor: colors.primary }]} onPress={() => setSelectedFuelType([])}>
                  <Text style={[styles.filterChipBtnText, selectedFuelType.length === 0 && { color: colors.primary }]}>ทั้งหมด</Text>
                </TouchableOpacity>
                {fuelTypesList.map(ft => (
                  <TouchableOpacity key={ft} style={[styles.filterChipBtn, selectedFuelType.includes(ft) && { backgroundColor: colors.primary + '15', borderColor: colors.primary }]} onPress={() => setSelectedFuelType(selectedFuelType.includes(ft) ? selectedFuelType.filter(x => x !== ft) : [...selectedFuelType, ft])}>
                    <Text style={[styles.filterChipBtnText, selectedFuelType.includes(ft) && { color: colors.primary }]}>{ft}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ปุ่มล้าง */}
              {(selectedProvince || selectedBrand.length > 0 || selectedFuelType.length > 0 || viewMode !== 'all' || radiusKm > 0) && (
                <TouchableOpacity style={styles.clearBtn} onPress={() => { setSelectedProvince(''); setSelectedBrand([]); setSelectedFuelType([]); setViewMode('all'); setRadiusKm(0); }}>
                  <Text style={styles.clearBtnText}>✕ ล้างตัวกรองทั้งหมด</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Tap overlay to dismiss card */}
          {selectedStation && (
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={hideStationCard} />
          )}

          {/* Bottom station card (slide up) */}
          {selectedStation && (
            <Animated.View style={[styles.bottomCard, { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }] }]}>
              <TouchableOpacity style={styles.cardCloseBtn} onPress={hideStationCard}>
                <Ionicons name="close" size={18} color="#666" />
              </TouchableOpacity>
              <View style={styles.cardHandle} />
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{selectedStation.name}</Text>
                  <Text style={styles.cardAddress}>{selectedStation.province_name} · {selectedStation.brand}</Text>
                  {selectedStation._distance != null && (
                    <Text style={styles.cardDistance}>📏 {selectedStation._distance.toFixed(1)} กม.</Text>
                  )}
                </View>
                <View style={[styles.statusChip, { backgroundColor: selectedStation.has_fuel ? colors.fuelAvailableBg : colors.fuelEmptyBg }]}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: selectedStation.has_fuel ? colors.fuelAvailable : colors.fuelEmpty }}>
                    {selectedStation.has_fuel ? '✓ มีน้ำมัน' : '✗ หมด'}
                  </Text>
                </View>
              </View>
              <View style={styles.cardFuels}>
                {selectedStation.fuels?.map(f => (
                  <View key={f.fuel_type} style={[styles.fuelChip, f.is_available ? styles.fuelChipOk : styles.fuelChipNo]}>
                    <Text style={[styles.fuelChipText, f.is_available ? styles.fuelChipTextOk : styles.fuelChipTextNo]}>
                      {f.is_available ? '✓' : '✗'} {f.fuel_type}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.cardBtn} onPress={() => { hideStationCard(); navigation.navigate('StationDetail', { id: selectedStation.id }); }}>
                  <Text style={styles.cardBtnText}>📋 รายละเอียด</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.cardBtn, styles.cardBtnNav]} onPress={() => navigateToStation(selectedStation)}>
                  <Text style={[styles.cardBtnText, { color: '#fff' }]}>🧭 นำทาง</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </View>
      )}

      {/* ===== LIST VIEW ===== */}
      {displayMode === 'list' && (
        <FlatList
          data={filtered}
          keyExtractor={s => String(s.id)}
          onScrollBeginDrag={() => { setShowProvinces(false); setShowBrands(false); }}
          onTouchStart={() => { if (showProvinces || showBrands) { setShowProvinces(false); setShowBrands(false); } }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: s }) => (
            <TouchableOpacity style={styles.listCard} onPress={() => { setShowProvinces(false); setShowBrands(false); navigation.navigate('StationDetail', { id: s.id }); }} activeOpacity={0.7}>
              <View style={styles.listCardLeft}>
                <View style={[styles.listDot, { backgroundColor: '#fff', borderWidth: 2.5, borderColor: s.has_fuel ? colors.fuelAvailable : colors.fuelEmpty }]}>
                  {s.brand_logo ? (
                    <Image source={{ uri: s.brand_logo }} style={{ width: 22, height: 22, borderRadius: 2 }} resizeMode="contain" />
                  ) : (
                    <Text style={{ fontSize: 16 }}>⛽</Text>
                  )}
                </View>
              </View>
              <View style={styles.listCardRight}>
                <Text style={styles.listName} numberOfLines={1}>{s.name}</Text>
                <Text style={styles.listSub}>{s.province_name} · {s.brand} {s._distance != null ? `· ${s._distance.toFixed(1)} กม.` : ''}</Text>
                <View style={styles.listFuels}>
                  {s.fuels?.slice(0, 4).map(f => (
                    <View key={f.fuel_type} style={[styles.fuelMini, f.is_available ? styles.fuelMiniOk : styles.fuelMiniNo]}>
                      <Text style={[styles.fuelMiniText, f.is_available ? { color: colors.fuelAvailable } : { color: colors.fuelEmpty }]}>{f.fuel_type}</Text>
                    </View>
                  ))}
                  {(s.fuels?.length || 0) > 4 && <Text style={styles.fuelMore}>+{s.fuels.length - 4}</Text>}
                </View>
              </View>
              <TouchableOpacity style={styles.listNav} onPress={() => navigateToStation(s)}>
                <Text style={{ fontSize: 20 }}>🧭</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 80 }}
          ListEmptyComponent={loading ? <Text style={styles.emptyText}>กำลังโหลด...</Text> : <Text style={styles.emptyText}>ไม่พบปั๊ม</Text>}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <TextInput style={styles.listSearch} placeholder="🔍 ค้นหาปั๊ม..." value={searchText} onChangeText={setSearchText} placeholderTextColor={colors.outlineVariant} onFocus={() => { setShowProvinces(false); setShowBrands(false); }} />

              {/* Filters */}
              <View style={styles.listFilterRow}>
                <TouchableOpacity style={[styles.listFilterBtn, selectedProvince && styles.listFilterBtnActive]} onPress={() => { setShowProvinces(!showProvinces); setShowBrands(false); }}>
                  <Text style={[styles.listFilterBtnText, selectedProvince && styles.listFilterBtnTextActive]} numberOfLines={1}>📍 {provinces.find(p => String(p.id) === selectedProvince)?.name || 'จังหวัด'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.listFilterBtn, selectedBrand.length > 0 && styles.listFilterBtnActive]} onPress={() => { setShowBrands(!showBrands); setShowProvinces(false); }}>
                  <Text style={[styles.listFilterBtnText, selectedBrand.length > 0 && styles.listFilterBtnTextActive]} numberOfLines={1}>⛽ {selectedBrand.length > 0 ? selectedBrand.join(', ') : 'แบรนด์'}</Text>
                </TouchableOpacity>
              </View>

              {showProvinces && (
                <ScrollView style={styles.listDropdown} nestedScrollEnabled>
                  <TouchableOpacity style={styles.listDropdownItem} onPress={() => { setSelectedProvince(''); setShowProvinces(false); }}>
                    <Text style={[styles.listDropdownText, !selectedProvince && { color: colors.primary, fontWeight: '700' }]}>ทุกจังหวัด</Text>
                  </TouchableOpacity>
                  {provinces.map(p => (
                    <TouchableOpacity key={p.id} style={styles.listDropdownItem} onPress={() => { setSelectedProvince(String(p.id)); setShowProvinces(false); }}>
                      <Text style={[styles.listDropdownText, selectedProvince === String(p.id) && { color: colors.primary, fontWeight: '700' }]}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {showBrands && (
                <ScrollView style={styles.listDropdown} nestedScrollEnabled>
                  <TouchableOpacity style={styles.listDropdownItem} onPress={() => { setSelectedBrand([]); setShowBrands(false); }}>
                    <Text style={[styles.listDropdownText, selectedBrand.length === 0 && { color: colors.primary, fontWeight: '700' }]}>ทุกแบรนด์</Text>
                  </TouchableOpacity>
                  {brands.map(b => (
                    <TouchableOpacity key={b} style={styles.listDropdownItem} onPress={() => { setSelectedBrand(selectedBrand.includes(b) ? selectedBrand.filter(x => x !== b) : [...selectedBrand, b]); }}>
                      <Text style={[styles.listDropdownText, selectedBrand.includes(b) && { color: colors.primary, fontWeight: '700' }]}>{selectedBrand.includes(b) ? '✓ ' : ''}{b}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Radius + Status */}
              <View style={styles.listRadiusRow}>
                {[0, 5, 10, 20, 50].map(r => (
                  <TouchableOpacity key={r} style={[styles.listRadiusBtn, radiusKm === r && styles.listRadiusBtnActive]} onPress={() => handleRadiusChange(r)}>
                    <Text style={[styles.listRadiusBtnText, radiusKm === r && styles.listRadiusBtnTextActive]}>{r === 0 ? 'ทั้งหมด' : `${r}กม.`}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.listStatusRow}>
                {[['all', `ทั้งหมด (${filtered.length})`], ['available', `🟢 มีน้ำมัน (${greenCount})`], ['empty', `🔴 หมด (${redCount})`]].map(([key, label]) => (
                  <TouchableOpacity key={key} style={[styles.listStatusBtn, viewMode === key && styles.listStatusBtnActive]} onPress={() => setViewMode(key)}>
                    <Text style={[styles.listStatusBtnText, viewMode === key && styles.listStatusBtnTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
        />
      )}

      {/* ===== BOTTOM TAB BAR ===== */}
      <View style={[styles.bottomBarOuter, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: mapTheme === 'dark' ? '#1a1a2e' : '#fff' }]} needsOffscreenAlphaCompositing>
        <View style={styles.bottomBar}>
        <View style={styles.bottomTab} onTouchEnd={() => { closeDropdowns(); setDisplayMode('map'); }}>
          <View style={[styles.bottomTabIconWrap, displayMode === 'map' && [styles.bottomTabIconWrapActive, { backgroundColor: mapTheme === 'dark' ? '#4ade80' : '#dbeafe' }]]}>
            <MaterialCommunityIcons name="map-marker-radius" size={22} color={displayMode === 'map' ? (mapTheme === 'dark' ? '#fff' : colors.primary) : (mapTheme === 'dark' ? 'rgba(255,255,255,0.4)' : '#999')} />
          </View>
          <Text style={[styles.bottomTabLabel, { color: displayMode === 'map' ? (mapTheme === 'dark' ? '#4ade80' : colors.primary) : (mapTheme === 'dark' ? 'rgba(255,255,255,0.4)' : '#999') }, displayMode === 'map' && styles.bottomTabLabelActive]}>แผนที่</Text>
        </View>
        <View style={styles.bottomTab} onTouchEnd={() => { closeDropdowns(); setDisplayMode('list'); }}>
          <View style={[styles.bottomTabIconWrap, displayMode === 'list' && [styles.bottomTabIconWrapActive, { backgroundColor: mapTheme === 'dark' ? '#4ade80' : '#dbeafe' }]]}>
            <Ionicons name="list" size={22} color={displayMode === 'list' ? (mapTheme === 'dark' ? '#fff' : colors.primary) : (mapTheme === 'dark' ? 'rgba(255,255,255,0.4)' : '#999')} />
          </View>
          <Text style={[styles.bottomTabLabel, { color: displayMode === 'list' ? (mapTheme === 'dark' ? '#4ade80' : colors.primary) : (mapTheme === 'dark' ? 'rgba(255,255,255,0.4)' : '#999') }, displayMode === 'list' && styles.bottomTabLabelActive]}>รายการ</Text>
        </View>
        {reportingEnabled && (
          <TouchableOpacity style={styles.bottomTabCenter} onPress={openReportMode}>
            <View style={styles.bottomTabCenterIcon}>
              <Ionicons name="add" size={28} color="#fff" />
            </View>
            <Text style={[styles.bottomTabLabel, { color: colors.primary, fontWeight: '700' }]}>รายงาน</Text>
          </TouchableOpacity>
        )}
        <View style={styles.bottomTab} onTouchEnd={navigateToNearest}>
          <View style={styles.bottomTabIconWrap}>
            <Ionicons name="navigate" size={20} color={mapTheme === 'dark' ? 'rgba(255,255,255,0.4)' : '#999'} />
          </View>
          <Text style={[styles.bottomTabLabel, { color: mapTheme === 'dark' ? 'rgba(255,255,255,0.4)' : '#999' }]}>ใกล้ฉัน</Text>
        </View>
        <View style={styles.bottomTab} onTouchEnd={() => { closeDropdowns(); navigation.navigate('Overview'); }}>
          <View style={styles.bottomTabIconWrap}>
            <Ionicons name="stats-chart" size={20} color={mapTheme === 'dark' ? 'rgba(255,255,255,0.4)' : '#999'} />
          </View>
          <Text style={[styles.bottomTabLabel, { color: mapTheme === 'dark' ? 'rgba(255,255,255,0.4)' : '#999' }]}>ภาพรวม</Text>
        </View>
        </View>
      </View>

      {/* ===== NEAREST STATION CARD ===== */}
      {nearestStation && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setNearestStation(null)}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => setNearestStation(null)}>
            <View />
          </TouchableOpacity>
          <View style={{ backgroundColor: mapTheme === 'dark' ? '#1a1a2e' : '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, paddingBottom: 80 }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#555', borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg }} />
            <Text style={{ fontSize: 20, fontWeight: '800', color: mapTheme === 'dark' ? '#fff' : colors.onSurface, marginBottom: 4 }}>{nearestStation.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: nearestStation.has_fuel ? '#4ade8020' : '#ff525220', borderRadius: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: nearestStation.has_fuel ? '#4ade80' : '#ff5252' }}>{nearestStation.has_fuel ? '● มีน้ำมัน' : '● หมด'}</Text>
              </View>
              <Text style={{ fontSize: 13, color: mapTheme === 'dark' ? '#aaa' : '#666' }}>{nearestStation.brand}</Text>
              <Text style={{ fontSize: 13, color: '#4ade80', fontWeight: '700' }}>{nearestDist.toFixed(1)} กม.</Text>
            </View>
            <Text style={{ fontSize: 13, color: mapTheme === 'dark' ? '#888' : '#999', marginBottom: spacing.lg }}>{nearestStation.address || nearestStation.province_name || ''}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, backgroundColor: '#4ade80', borderRadius: 12 }} onPress={() => { setNearestStation(null); navigateToStation(nearestStation); }}>
                <Ionicons name="navigate" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>นำทาง</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, backgroundColor: mapTheme === 'dark' ? '#2a2a3e' : '#f0f0f0', borderRadius: 12 }} onPress={() => { setNearestStation(null); setShowNavSettings(true); }}>
                <Ionicons name="settings-outline" size={18} color={mapTheme === 'dark' ? '#aaa' : '#666'} />
                <Text style={{ color: mapTheme === 'dark' ? '#aaa' : '#666', fontWeight: '700', fontSize: 15 }}>ตั้งค่า</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ===== NAV SETTINGS MODAL ===== */}
      {showNavSettings && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowNavSettings(false)}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => setShowNavSettings(false)}>
            <View />
          </TouchableOpacity>
          <View style={{ backgroundColor: mapTheme === 'dark' ? '#1a1a2e' : '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 40 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: mapTheme === 'dark' ? '#2a2a3e' : '#e0e0e0' }}>
              <TouchableOpacity onPress={() => setShowNavSettings(false)}>
                <Ionicons name="close" size={24} color={mapTheme === 'dark' ? '#fff' : colors.onSurface} />
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: '700', color: mapTheme === 'dark' ? '#fff' : colors.onSurface }}>⚙️ ตั้งค่านำทาง</Text>
              <TouchableOpacity onPress={() => { setShowNavSettings(false); navigateToNearest(); }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#4ade80' }}>นำทาง</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: spacing.lg }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: mapTheme === 'dark' ? '#fff' : colors.onSurface, marginBottom: spacing.sm }}>⛽ แบรนด์ที่ต้องการ</Text>
              <Text style={{ fontSize: 11, color: '#999', marginBottom: spacing.sm }}>ไม่เลือก = ทุกแบรนด์</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.lg }}>
                {brands.map(b => (
                  <TouchableOpacity key={b} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: navBrands.includes(b) ? '#4ade80' : '#555', backgroundColor: navBrands.includes(b) ? '#4ade8020' : 'transparent' }}
                    onPress={() => setNavBrands(navBrands.includes(b) ? navBrands.filter(x => x !== b) : [...navBrands, b])}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: navBrands.includes(b) ? '#4ade80' : (mapTheme === 'dark' ? '#ccc' : '#666') }}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontSize: 14, fontWeight: '700', color: mapTheme === 'dark' ? '#fff' : colors.onSurface, marginBottom: spacing.sm }}>🛢️ ชนิดน้ำมัน</Text>
              <Text style={{ fontSize: 11, color: '#999', marginBottom: spacing.sm }}>ไม่เลือก = ทุกชนิด (ต้องมีน้ำมันอย่างน้อย 1 ชนิด)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.lg }}>
                {fuelTypesList.map(ft => (
                  <TouchableOpacity key={ft} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: navFuelTypes.includes(ft) ? '#38bdf8' : '#555', backgroundColor: navFuelTypes.includes(ft) ? '#38bdf820' : 'transparent' }}
                    onPress={() => setNavFuelTypes(navFuelTypes.includes(ft) ? navFuelTypes.filter(x => x !== ft) : [...navFuelTypes, ft])}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: navFuelTypes.includes(ft) ? '#38bdf8' : (mapTheme === 'dark' ? '#ccc' : '#666') }}>{ft}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {(navBrands.length > 0 || navFuelTypes.length > 0) && (
                <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10 }} onPress={() => { setNavBrands([]); setNavFuelTypes([]); }}>
                  <Text style={{ fontSize: 13, color: '#f87171' }}>✕ ล้างทั้งหมด</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* ===== REPORT MODAL ===== */}
      {showReportModal && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowReportModal(false)}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => setShowReportModal(false)}>
            <View />
          </TouchableOpacity>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, paddingBottom: 40, maxHeight: '80%' }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#ccc', borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md }} />
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.onSurface, marginBottom: spacing.md }}>📝 รายงานสถานะน้ำมัน</Text>

            {/* เลือกปั๊ม */}
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 6 }}>เลือกปั๊ม (ใกล้คุณ ≤500m)</Text>
            <ScrollView style={{ maxHeight: 120, marginBottom: spacing.md }} nestedScrollEnabled>
              {stations
                .map(s => ({ ...s, _dist: getDistance(userLat, userLng, s.lat, s.lng) * 1000 }))
                .filter(s => s._dist <= 500)
                .sort((a, b) => a._dist - b._dist)
                .map(s => (
                  <TouchableOpacity key={s.id} style={{ padding: 10, borderRadius: 8, borderWidth: 1.5, borderColor: reportStation?.id === s.id ? colors.primary : '#d1d5db', backgroundColor: reportStation?.id === s.id ? '#eff6ff' : '#fff', marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between' }}
                    onPress={() => setReportStation(s)}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: reportStation?.id === s.id ? colors.primary : '#333' }}>{s.name}</Text>
                    <Text style={{ fontSize: 11, color: '#999' }}>{Math.round(s._dist)}m</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            {/* เลือกชนิดน้ำมัน */}
            {reportStation && (
              <>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 6 }}>ชนิดน้ำมัน</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md }}>
                  {fuelTypesList.map(ft => (
                    <TouchableOpacity key={ft} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1.5, borderColor: reportFuelType === ft ? colors.primary : '#d1d5db', backgroundColor: reportFuelType === ft ? '#eff6ff' : '#fff' }}
                      onPress={() => setReportFuelType(ft)}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: reportFuelType === ft ? colors.primary : '#555' }}>{ft}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* มี/หมด */}
            {reportFuelType !== '' && (
              <>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 6 }}>สถานะ</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md }}>
                  <TouchableOpacity style={{ flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: reportAvailable ? '#16a34a' : '#d1d5db', backgroundColor: reportAvailable ? '#f0fdf4' : '#fff', alignItems: 'center' }}
                    onPress={() => setReportAvailable(true)}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: reportAvailable ? '#16a34a' : '#999' }}>🟢 มีน้ำมัน</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: !reportAvailable ? '#dc2626' : '#d1d5db', backgroundColor: !reportAvailable ? '#fef2f2' : '#fff', alignItems: 'center' }}
                    onPress={() => setReportAvailable(false)}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: !reportAvailable ? '#dc2626' : '#999' }}>🔴 น้ำมันหมด</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Submit */}
            {reportFuelType !== '' && (
              <TouchableOpacity style={{ backgroundColor: colors.primary, padding: 14, borderRadius: 12, alignItems: 'center', opacity: reportSubmitting ? 0.5 : 1 }}
                onPress={doSubmitReport} disabled={reportSubmitting}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{reportSubmitting ? 'กำลังส่ง...' : '📤 ส่งรายงาน'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Modal>
      )}


      {/* ===== LINE LOGIN CARD ===== */}
      {showLoginCard && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowLoginCard(false)}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setShowLoginCard(false)}>
            <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 28, width: '85%', maxWidth: 340, alignItems: 'center' }} onStartShouldSetResponder={() => true}>
              {/* Logo */}
              <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#06c755', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="chatbubble-ellipses" size={36} color="#fff" />
              </View>

              <Text style={{ fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 6, textAlign: 'center' }}>เข้าสู่ระบบด้วย LINE</Text>
              <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
                เพื่อรายงานสถานะน้ำมัน{'\n'}ให้คนอื่นรู้ว่าปั๊มไหนมีน้ำมัน
              </Text>

              {/* LINE Login Button */}
              <TouchableOpacity
                style={{ backgroundColor: '#06c755', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, width: '100%', marginBottom: 12 }}
                onPress={() => { setShowLoginCard(false); doLineLogin(); }}
              >
                <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>เข้าสู่ระบบด้วย LINE</Text>
              </TouchableOpacity>

              {/* Cancel */}
              <TouchableOpacity onPress={() => setShowLoginCard(false)} style={{ padding: 10 }}>
                <Text style={{ fontSize: 14, color: '#999' }}>ยกเลิก</Text>
              </TouchableOpacity>

              {/* Note */}
              <Text style={{ fontSize: 11, color: '#bbb', textAlign: 'center', marginTop: 12 }}>
                เราใช้ LINE เพื่อยืนยันตัวตนเท่านั้น{'\n'}ไม่มีการส่งข้อความรบกวน
              </Text>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* ===== SEARCH MODAL ===== */}
      {showSearch && (
        <View style={styles.searchModal}>
          <View style={styles.searchModalHeader}>
            <TextInput
              style={styles.searchModalInput}
              placeholder="ค้นหาปั๊ม, แบรนด์, จังหวัด..."
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
              placeholderTextColor={colors.outlineVariant}
            />
            <TouchableOpacity onPress={() => setShowSearch(false)}>
              <Text style={styles.searchCancel}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={filtered.slice(0, 20)}
            keyExtractor={s => String(s.id)}
            renderItem={({ item: s }) => (
              <TouchableOpacity style={styles.searchResult} onPress={() => {
                setShowSearch(false);
                setShowSearch(false);
                setSelectedStation(null);
                showStationCard(s);
              }}>
                <Text style={styles.searchResultName}>{s.name}</Text>
                <Text style={styles.searchResultSub}>{s.province_name} · {s.brand} {s._distance != null ? `· ${s._distance.toFixed(1)} กม.` : ''}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  // Floating elements on map
  floatingSearch: { position: 'absolute', top: 10, left: 16, right: 16, zIndex: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: rad.xl, paddingHorizontal: 16, paddingVertical: 12, ...shadows.ambient, borderLeftWidth: 4, borderLeftColor: colors.primary },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchPlaceholder: { flex: 1, fontSize: 15, color: colors.outlineVariant },
  countBadge: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  countText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  filterPills: { flexDirection: 'row', gap: 6, marginTop: 8 },
  filterPill: { flex: 1, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderRadius: rad.xl, ...shadows.soft },
  filterPillActive: { backgroundColor: '#e8f0fe', borderWidth: 1, borderColor: colors.primary },
  filterPillText: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  filterPillTextActive: { color: colors.primary },
  floatingTopBar: { position: 'absolute', top: 8, left: 10, right: 10, zIndex: 10 },
  topBarRow: { flexDirection: 'row', alignItems: 'center' },
  scrollHint: { paddingHorizontal: 6, paddingVertical: 4, backgroundColor: '#e0f2f1', borderRadius: 8 },
  topChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: rad.xl, backgroundColor: '#fff', marginRight: 5, ...shadows.soft },
  topChipActive: { backgroundColor: colors.primary },
  topChipText: { fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant },
  topChipTextActive: { color: '#fff' },
  filterIconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.ambient },
  filterDot: { position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b', borderWidth: 1, borderColor: '#fff' },
  radiusToggle: { position: 'absolute', right: 8, top: '30%', zIndex: 9, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', ...shadows.ambient },
  themeToggle: { position: 'absolute', right: 8, bottom: 80, zIndex: 9, width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadows.ambient },
  radiusSlide: { position: 'absolute', right: 8, top: '38%', zIndex: 8, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: rad.md, paddingVertical: 3, paddingHorizontal: 1, ...shadows.soft, alignItems: 'center' },
  radiusSlideBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginVertical: 1 },
  radiusSlideBtnActive: { backgroundColor: colors.primary },
  radiusSlideText: { fontSize: 10, fontWeight: '700', color: colors.onSurfaceVariant },
  radiusSlideTextActive: { color: '#fff' },
  radiusSlideLabel: { fontSize: 8, color: colors.outlineVariant, marginTop: 1 },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#e8f0fe', paddingHorizontal: 10, paddingVertical: 5, borderRadius: rad.xl, marginRight: 6 },
  activeChipText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  filterPanel: { backgroundColor: '#fff', borderRadius: rad.lg, padding: spacing.md, marginTop: 8, ...shadows.ambient },
  filterLabel: { fontSize: 11, fontWeight: '700', color: colors.onSurfaceVariant, marginBottom: 4 },
  filterSelect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surfaceLow, borderRadius: rad.md, borderWidth: 1, borderColor: '#ddd', marginBottom: 4 },
  filterSelectText: { fontSize: 13, color: colors.onSurface },
  filterChipBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: rad.xl, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' },
  filterChipBtnText: { fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant },
  clearBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 8 },
  clearBtnText: { fontSize: 12, fontWeight: '600', color: colors.fuelEmpty },
  filterDropdown: { backgroundColor: '#fff', borderRadius: rad.lg, marginTop: 6, maxHeight: 300, ...shadows.ambient },
  filterDropdownItem: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: colors.surfaceLow },
  filterDropdownText: { fontSize: 14, color: colors.onSurface },
  filterDropdownTextActive: { color: colors.primary, fontWeight: '700' },

  floatingRadius: { position: 'absolute', top: 110, left: 16, flexDirection: 'row', zIndex: 5 },
  radiusPill: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff', borderRadius: rad.xl, marginRight: 6, ...shadows.soft },
  radiusPillActive: { backgroundColor: colors.primary, transform: [{ scale: 1.05 }] },
  radiusPillText: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant },
  radiusPillTextActive: { color: '#fff' },

  floatingRight: { position: 'absolute', top: 150, right: 16, alignItems: 'flex-end', zIndex: 5 },
  fabSmall: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 8, ...shadows.ambient },
  fabIcon: { fontSize: 20 },
  statusPill: { backgroundColor: '#fff', borderRadius: rad.xl, paddingHorizontal: 10, paddingVertical: 6, ...shadows.soft },
  statusGreen: { fontSize: 12, fontWeight: '700', color: colors.fuelAvailable },
  statusRed: { fontSize: 12, fontWeight: '700', color: colors.fuelEmpty },

  // Bottom station card
  bottomCard: { position: 'absolute', bottom: 70, left: 12, right: 12, backgroundColor: '#fff', borderRadius: rad.lg, padding: 16, ...shadows.ambient },
  cardCloseBtn: { position: 'absolute', top: 8, left: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  cardHandle: { width: 40, height: 4, backgroundColor: colors.surfaceVariant, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName: { fontSize: 16, fontWeight: '700', color: colors.onSurface, marginBottom: 2 },
  cardAddress: { fontSize: 13, color: colors.onSurfaceVariant },
  cardDistance: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 2 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  cardFuels: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 10 },
  fuelChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: rad.xl },
  fuelChipOk: { backgroundColor: colors.fuelAvailableBg },
  fuelChipNo: { backgroundColor: colors.fuelEmptyBg },
  fuelChipText: { fontSize: 11, fontWeight: '500' },
  fuelChipTextOk: { color: colors.fuelAvailable },
  fuelChipTextNo: { color: colors.fuelEmpty, textDecorationLine: 'line-through' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  cardBtn: { flex: 1, paddingVertical: 10, borderRadius: rad.md, backgroundColor: colors.surfaceLow, alignItems: 'center' },
  cardBtnNav: { backgroundColor: colors.fuelAvailable },
  cardBtnText: { fontSize: 14, fontWeight: '600', color: colors.onSurface },

  // List view
  listCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: rad.lg, padding: 14, marginBottom: 10, ...shadows.soft },
  listCardLeft: { marginRight: 12, paddingTop: 2 },
  listDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  listCardRight: { flex: 1 },
  listName: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  listSub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
  listFuels: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  fuelMini: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  fuelMiniOk: { backgroundColor: colors.fuelAvailableBg },
  fuelMiniNo: { backgroundColor: colors.fuelEmptyBg },
  fuelMiniText: { fontSize: 10, fontWeight: '500' },
  fuelMore: { fontSize: 10, color: colors.onSurfaceVariant, alignSelf: 'center' },
  listNav: { justifyContent: 'center', paddingLeft: 8 },
  listSearch: { padding: 12, backgroundColor: '#fff', borderRadius: rad.lg, fontSize: 15, marginBottom: 10, ...shadows.soft, borderLeftWidth: 4, borderLeftColor: colors.primary },
  listHeader: {},
  listFilterRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  listFilterBtn: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderRadius: rad.lg, ...shadows.soft },
  listFilterBtnActive: { backgroundColor: '#e8f0fe', borderWidth: 1, borderColor: colors.primary },
  listFilterBtnText: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  listFilterBtnTextActive: { color: colors.primary },
  listDropdown: { backgroundColor: '#fff', borderRadius: rad.lg, marginBottom: 10, maxHeight: 250, ...shadows.ambient },
  listDropdownItem: { paddingVertical: 11, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: colors.surfaceLow },
  listDropdownText: { fontSize: 14, color: colors.onSurface },
  listRadiusRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  listRadiusBtn: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fff', borderRadius: rad.xl, ...shadows.soft },
  listRadiusBtnActive: { backgroundColor: colors.primary },
  listRadiusBtnText: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant },
  listRadiusBtnTextActive: { color: '#fff' },
  listStatusRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  listStatusBtn: { flex: 1, paddingVertical: 7, borderRadius: rad.xl, backgroundColor: '#fff', alignItems: 'center', ...shadows.soft },
  listStatusBtnActive: { backgroundColor: '#e8f0fe', borderWidth: 1, borderColor: colors.primary },
  listStatusBtnText: { fontSize: 11, color: colors.onSurfaceVariant, fontWeight: '500' },
  listStatusBtnTextActive: { color: colors.primary, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: colors.onSurfaceVariant, padding: 40, fontSize: 15 },

  // Bottom tab bar
  bottomBarOuter: { backgroundColor: '#1a1a2e', borderTopWidth: 0, elevation: 10 },
  bottomBar: { flexDirection: 'row', paddingTop: 10 },
  bottomTab: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: rad.lg, marginHorizontal: 4 },
  bottomTabIconWrap: { width: 44, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  bottomTabIconWrapActive: { borderRadius: 14 },
  bottomTabLabel: { fontSize: 10, fontWeight: '600' },
  bottomTabLabelActive: { fontWeight: '700' },
  bottomTabCenter: { alignItems: 'center', marginTop: -20 },
  bottomTabCenterIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.soft, marginBottom: 2 },

  // Search modal
  searchModal: { ...StyleSheet.absoluteFillObject, backgroundColor: '#fff', zIndex: 100, paddingTop: Platform.OS === 'ios' ? 50 : 10 },
  searchModalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.surfaceLow },
  searchModalInput: { flex: 1, fontSize: 16, padding: 10, color: colors.onSurface },
  searchCancel: { fontSize: 15, color: colors.primary, fontWeight: '600', paddingLeft: 12 },
  searchResult: { paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 0.5, borderBottomColor: colors.surfaceLow },
  searchResultName: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  searchResultSub: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 2 },
});
