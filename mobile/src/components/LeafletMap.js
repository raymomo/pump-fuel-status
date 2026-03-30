import { useRef, useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { provinceCoords } from '../utils/provinceCoords';

export default function LeafletMap({ stations, userLat, userLng, radiusKm, onMarkerPress, style, selectedProvinceName, mapTheme = 'dark' }) {
  const webRef = useRef(null);
  const didFitBounds = useRef(false);
  const lastProvince = useRef(null);

  const html = useMemo(() => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; background: ${mapTheme === 'dark' ? '#1a1a2e' : '#f5f5f5'}; }
    ${mapTheme === 'dark' ? '.leaflet-tile-pane { filter: invert(1) hue-rotate(200deg) brightness(0.8) contrast(1.1) saturate(0.15); }' : '.leaflet-tile-pane { filter: saturate(0.2) brightness(1.05); }'}
    .marker-label { font-size: 10px; font-weight: 600; text-align: center; white-space: nowrap; text-shadow: 0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff; max-width: 100px; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
    .user-dot { width: 14px; height: 14px; background: #0058bc; border: 3px solid #fff; border-radius: 50%; box-shadow: 0 0 10px rgba(0,88,188,0.5); }
    .cluster-icon { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; color: #fff; font-size: 14px; font-weight: 700; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
    .leaflet-popup-close-button { display: none !important; }
    .leaflet-popup-content { margin: 14px 16px !important; margin-top: 8px !important; }
    .cluster-green { background: #1b8a4a; }
    .cluster-mixed { background: linear-gradient(135deg, #1b8a4a, #f59e0b); }
    .cluster-red { background: #c62828; }
    .fuel-popup { background: rgba(30,30,30,0.92); border-radius: 8px; padding: 6px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.4); min-width: 80px; }
    .fuel-popup-name { font-size: 11px; font-weight: 700; color: #fff; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; }
    .fuel-popup-grid { display: flex; flex-wrap: wrap; gap: 2px; }
    .fuel-tag { font-size: 9px; font-weight: 700; padding: 2px 5px; border-radius: 3px; text-align: center; }
    .fuel-tag-ok { background: #1b8a4a; color: #fff; }
    .fuel-tag-no { background: #444; color: #888; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([13.75, 100.50], 10);
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=th', { attribution: '' }).addTo(map);

    var markers = [];
    var clusterMarkers = [];
    var allStations = [];
    var userMarker = null;
    var radiusCircle = null;

    function createFuelPopup(s) {
      var fuels = s.fuels || [];
      var tags = fuels.map(function(f) {
        var label = f.fuel_type.replace('แก๊สโซฮอล์ ','').replace('ดีเซล','D').replace('Diesel','D');
        if (label.length > 5) label = label.slice(0,5);
        return '<span class="fuel-tag '+(f.is_available?'fuel-tag-ok':'fuel-tag-no')+'">'+label+'</span>';
      }).join('');
      var name = s.name.length > 15 ? s.name.slice(0,15)+'…' : s.name;
      return L.divIcon({
        className: '',
        html: '<div class="fuel-popup"><div class="fuel-popup-name">'+name+'</div><div class="fuel-popup-grid">'+tags+'</div></div>',
        iconSize: [130, 60],
        iconAnchor: [65, 60],
      });
    }

    var logoCache = {};
    function createIcon(hasFuel, name, logoUrl) {
      var borderColor = hasFuel ? '#1b8a4a' : '#c62828';
      var inner = '';
      if (logoUrl) {
        inner = '<img src="'+logoUrl+'" style="width:18px;height:18px;object-fit:contain;border-radius:2px;" onerror="this.style.display=\\'none\\';this.nextSibling.style.display=\\'block\\'">' +
                '<span style="display:none;font-size:11px;font-weight:800;color:#fff">⛽</span>';
      } else {
        inner = '<span style="font-size:12px;">⛽</span>';
      }
      return L.divIcon({
        className: '',
        html: '<div style="width:26px;height:26px;background:#fff;border:3px solid '+borderColor+';border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;overflow:hidden;">'+inner+'</div><div class="marker-label">'+(name.length > 18 ? name.slice(0,18)+'…' : name)+'</div>',
        iconSize: [100, 38],
        iconAnchor: [50, 32],
        popupAnchor: [0, -28],
      });
    }

    function clearMarkers() {
      markers.forEach(function(m) { map.removeLayer(m); });
      clusterMarkers.forEach(function(m) { map.removeLayer(m); });
      markers = [];
      clusterMarkers = [];
    }

    function renderMarkers() {
      clearMarkers();
      var zoom = map.getZoom();
      var bounds = map.getBounds();
      var visible = allStations.filter(function(s) { return bounds.contains([s.lat, s.lng]); });

      if (zoom < 12) {
        // Zoom ไกล → จุดเล็ก
        var r = zoom <= 5 ? 1.5 : zoom <= 7 ? 2 : zoom <= 9 ? 3 : 4;
        var op = zoom <= 7 ? 0.5 : 0.7;
        visible.forEach(function(s) {
          var m = L.circleMarker([s.lat, s.lng], {
            radius: r, fillColor: s.has_fuel ? '#00e676' : '#ff5252',
            fillOpacity: op, color: '#fff', weight: 0.5,
          }).addTo(map).on('click', function() {
            map.setView([s.lat, s.lng], 15);
          });
          markers.push(m);
        });
      } else if (zoom < 15) {
        // Zoom กลาง → logo แบรนด์เล็ก + ขอบสถานะ
        visible.forEach(function(s) {
          var borderColor = s.has_fuel ? '#1b8a4a' : '#c62828';
          var inner = s.brand_logo
            ? '<img src="'+s.brand_logo+'" style="width:16px;height:16px;object-fit:contain;border-radius:2px" onerror="this.outerHTML=\\'⛽\\'">'
            : '<span style="font-size:10px">⛽</span>';
          var icon = L.divIcon({
            className: '',
            html: '<div style="width:24px;height:24px;background:#fff;border:2.5px solid '+borderColor+';border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;overflow:hidden">'+inner+'</div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
          var m = L.marker([s.lat, s.lng], { icon: icon }).addTo(map)
            .on('click', function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker', id: s.id }));
            });
          markers.push(m);
        });
      } else {
        // Zoom ใกล้ → fuel popup + logo ด้านล่าง
        visible.forEach(function(s) {
          var borderColor = s.has_fuel ? '#00e676' : '#ff5252';
          var logoHtml = s.brand_logo ? '<img src="'+s.brand_logo+'" style="width:18px;height:18px;object-fit:contain;border-radius:2px">' : '<span style="font-size:12px">⛽</span>';
          var pinIcon = L.divIcon({
            className: '',
            html: '<div style="display:flex;flex-direction:column;align-items:center">'
              + createFuelPopup(s).options.html
              + '<div style="width:28px;height:28px;background:#fff;border:3px solid '+borderColor+';border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-top:-2px;box-shadow:0 2px 6px rgba(0,0,0,0.4)">'
              + logoHtml + '</div></div>',
            iconSize: [130, 85],
            iconAnchor: [65, 85],
          });
          var m = L.marker([s.lat, s.lng], { icon: pinIcon })
            .addTo(map)
            .on('click', function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker', id: s.id }));
            });
          markers.push(m);
        });
      }
    }

    map.on('moveend', renderMarkers);
    map.on('zoomend', renderMarkers);
    map.on('click', function() {
      map.closePopup();
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapClick' }));
    });

    // แสดง fuel popup อัตโนมัติสำหรับปั๊มใกล้จุดกลางจอ
    window._popupMarkers = [];
    function showCenterPopups() {
      // ลบ popup เก่า
      window._popupMarkers.forEach(function(p) { map.removeLayer(p); });
      window._popupMarkers = [];

      var zoom = map.getZoom();
      if (zoom < 12 || zoom >= 15) return; // แสดงเฉพาะ zoom กลาง

      var center = map.getCenter();
      var radius = zoom < 13 ? 0.03 : 0.015; // ~3km หรือ ~1.5km
      var nearby = allStations.filter(function(s) {
        var d = Math.sqrt(Math.pow(s.lat - center.lat, 2) + Math.pow(s.lng - center.lng, 2));
        return d < radius;
      }).slice(0, 8); // จำกัด 8 ปั๊ม ไม่ให้หนัก

      nearby.forEach(function(s) {
        var pm = L.marker([s.lat, s.lng], { icon: createFuelPopup(s), zIndexOffset: 1000 }).addTo(map)
          .on('click', function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker', id: s.id }));
          });
        window._popupMarkers.push(pm);
      });
    }
    map.on('moveend', showCenterPopups);
    map.on('zoomend', showCenterPopups);

    function updateStations(data) {
      allStations = data;
      renderMarkers();
    }

    var userLocated = false;
    function setUserLocation(lat, lng, radius) {
      if (userMarker) map.removeLayer(userMarker);
      if (radiusCircle) map.removeLayer(radiusCircle);
      userMarker = L.marker([lat, lng], { icon: L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }) }).addTo(map);
      if (radius > 0) {
        radiusCircle = L.circle([lat, lng], { radius: radius * 1000, color: '#0058bc', fillColor: '#0058bc', fillOpacity: 0.06, weight: 2, dashArray: '8 4' }).addTo(map);
        var zoom = radius <= 5 ? 14 : radius <= 10 ? 13 : radius <= 20 ? 12 : 10;
        map.setView([lat, lng], zoom);
      } else if (!userLocated) {
        userLocated = true;
      }
    }

    function fitAll(data) {
      if (data.length > 0) {
        var bounds = L.latLngBounds(data.map(function(s) { return [s.lat, s.lng]; }));
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
      }
    }

    window.handleMessage = function(msg) {
      var d = JSON.parse(msg);
      if (d.type === 'stations') {
        updateStations(d.data);
        if (d.fitBounds && d.data.length > 0) fitAll(d.data);
        if (d.centerLat && d.centerLng) map.setView([d.centerLat, d.centerLng], 10);
      }
      if (d.type === 'location') setUserLocation(d.lat, d.lng, d.radius);
    };
  </script>
</body>
</html>`, [mapTheme]);

  useEffect(() => {
    if (webRef.current) {
      const coords = selectedProvinceName ? provinceCoords[selectedProvinceName] : null;
      const provinceChanged = selectedProvinceName !== lastProvince.current;
      lastProvince.current = selectedProvinceName;
      const shouldFit = false; // ไม่ fitBounds เพราะมี 4500+ ปั๊ม จะ zoom กว้างเกินไป
      if (shouldFit) didFitBounds.current = true;
      webRef.current.postMessage(JSON.stringify({
        type: 'stations',
        data: stations,
        hasUser: !!userLat,
        fitBounds: shouldFit,
        centerLat: provinceChanged && coords ? coords.lat : undefined,
        centerLng: provinceChanged && coords ? coords.lng : undefined,
      }));
    }
  }, [stations, selectedProvinceName, mapTheme]);

  useEffect(() => {
    if (webRef.current && userLat) {
      webRef.current.postMessage(JSON.stringify({ type: 'location', lat: userLat, lng: userLng, radius: radiusKm }));
    }
  }, [userLat, userLng, radiusKm, mapTheme]);

  const handleMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      onMarkerPress?.(msg);
    } catch {}
  };

  return (
    <WebView
      ref={webRef}
      source={{ html }}
      style={[styles.map, style]}
      onMessage={handleMessage}
      onLoad={() => {
        setTimeout(() => {
          const coords = selectedProvinceName ? provinceCoords[selectedProvinceName] : null;
          webRef.current?.postMessage(JSON.stringify({
            type: 'stations',
            data: stations,
            hasUser: !!userLat,
            fitBounds: !coords && stations.length > 0,
            centerLat: coords?.lat,
            centerLng: coords?.lng,
          }));
          if (userLat) {
            webRef.current?.postMessage(JSON.stringify({ type: 'location', lat: userLat, lng: userLng, radius: radiusKm }));
          }
        }, 500);
      }}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      injectedJavaScript={`
        document.addEventListener('message', function(e) { window.handleMessage(e.data); });
        window.addEventListener('message', function(e) { window.handleMessage(e.data); });
        true;
      `}
    />
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
