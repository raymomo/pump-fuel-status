import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { colors, spacing } from '../styles/theme';

export default function MapPickerModal({ lat, lng, onSelect, onClose }) {
  const [picked, setPicked] = useState({ lat, lng });
  const [initLoc, setInitLoc] = useState(null);
  const webRef = useRef(null);

  // ดึง GPS เฉพาะตอนเพิ่มใหม่ (ไม่มีตำแหน่งเดิม)
  const isNewLocation = lat === 13.75 && lng === 100.5;
  useEffect(() => {
    if (!isNewLocation) return; // edit mode มีตำแหน่งปั๊มแล้ว ไม่ต้องดึง GPS
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        const pos = { lat: last.coords.latitude, lng: last.coords.longitude };
        setInitLoc(pos);
        setPicked(pos);
      }
      const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (fresh) {
        const pos = { lat: fresh.coords.latitude, lng: fresh.coords.longitude };
        setInitLoc(pos);
        setPicked(pos);
      }
    })();
  }, []);

  const startLat = initLoc?.lat || lat;
  const startLng = initLoc?.lng || lng;

  const mapHtml = `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>html,body,#map{margin:0;padding:0;width:100%;height:100%}</style>
  </head><body>
    <div id="map"></div>
    <script>
      var map = L.map('map').setView([${startLat},${startLng}], 16);
      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=th',{maxZoom:20}).addTo(map);
      var marker = L.marker([${startLat},${startLng}],{draggable:true}).addTo(map);
      var myDot=null,myCircle=null;
      marker.on('dragend',function(e){
        var p=e.target.getLatLng();
        window.ReactNativeWebView.postMessage(JSON.stringify({lat:p.lat,lng:p.lng}));
      });
      map.on('click',function(e){
        marker.setLatLng(e.latlng);
        window.ReactNativeWebView.postMessage(JSON.stringify({lat:e.latlng.lat,lng:e.latlng.lng}));
      });
      function goToMe(lat,lng){
        if(myDot){map.removeLayer(myDot);map.removeLayer(myCircle);}
        myDot=L.circleMarker([lat,lng],{radius:8,color:'#fff',weight:2,fillColor:'#0891b2',fillOpacity:1}).addTo(map).bindPopup('ตำแหน่งปัจจุบัน');
        myCircle=L.circle([lat,lng],{radius:50,color:'#0891b2',fillColor:'#0891b2',fillOpacity:0.1,weight:1}).addTo(map);
        map.setView([lat,lng],16);
        marker.setLatLng([lat,lng]);
        window.ReactNativeWebView.postMessage(JSON.stringify({lat:lat,lng:lng}));
      }
    </script>
  </body></html>`;

  const handleGPS = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const last = await Location.getLastKnownPositionAsync();
    const loc = last || await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = loc.coords;
    setPicked({ lat: latitude, lng: longitude });
    webRef.current?.injectJavaScript(`goToMe(${latitude},${longitude});true;`);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: colors.surfaceLow }}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.onSurface} /></TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.onSurface }}>เลือกตำแหน่ง</Text>
          <TouchableOpacity onPress={() => onSelect(picked.lat, picked.lng)}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.admin }}>ยืนยัน</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ textAlign: 'center', fontSize: 12, color: colors.onSurfaceVariant, paddingVertical: 4 }}>
          กดหรือลากหมุดเพื่อเลือกตำแหน่ง · {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
        </Text>
        <View style={{ flex: 1 }}>
          <WebView
            ref={webRef}
            source={{ html: mapHtml }}
            style={{ flex: 1 }}
            onMessage={(e) => {
              try {
                const d = JSON.parse(e.nativeEvent.data);
                setPicked({ lat: d.lat, lng: d.lng });
              } catch {}
            }}
          />
          <TouchableOpacity
            style={{ position: 'absolute', bottom: 80, right: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: '#0891b2', alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
            onPress={handleGPS}
          >
            <Ionicons name="locate" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
