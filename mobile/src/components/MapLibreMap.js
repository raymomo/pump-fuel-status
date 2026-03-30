import { useRef, useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { provinceCoords } from '../utils/provinceCoords';

export default function MapLibreMap({ stations, userLat, userLng, radiusKm, onMarkerPress, style, selectedProvinceName, mapTheme = 'dark' }) {
  const webRef = useRef(null);
  const lastProvince = useRef(null);

  const html = useMemo(() => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; }
    .fuel-popup { background: rgba(30,30,30,0.92); border-radius: 8px; padding: 6px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.4); min-width: 80px; pointer-events: auto; cursor: pointer; }
    .fuel-popup-name { font-size: 11px; font-weight: 700; color: #fff; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; }
    .fuel-popup-grid { display: flex; flex-wrap: wrap; gap: 2px; }
    .fuel-tag { font-size: 9px; font-weight: 700; padding: 2px 5px; border-radius: 3px; }
    .fuel-tag-ok { background: #1b8a4a; color: #fff; }
    .fuel-tag-no { background: #444; color: #888; }
    .maplibregl-popup-content { background: none !important; box-shadow: none !important; padding: 0 !important; }
    .maplibregl-popup-tip { display: none !important; }
    .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var mapStyle = '${mapTheme === 'dark'
      ? 'https://tiles.openfreemap.org/styles/dark'
      : 'https://tiles.openfreemap.org/styles/liberty'}';

    var map = new maplibregl.Map({
      container: 'map',
      style: mapStyle,
      center: [100.50, 13.75],
      zoom: 9,
      attributionControl: false,
      dragRotate: false,
      touchPitch: false,
      pitchWithRotate: false,
      bearing: 0,
      maxPitch: 0,
    });

    var allStations = [];
    var mapLoaded = false;
    var pendingMessages = [];

    // ปิดหมุน map ด้วยนิ้ว
    map.touchZoomRotate.disableRotation();

    // คลิก map
    map.on('click', function(e) {
      // เช็คว่าคลิกที่จุดหรือไม่
      var features = map.queryRenderedFeatures(e.point, { layers: ['stations-circle'] });
      if (features.length > 0) {
        var id = features[0].properties.id;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker', id: id }));
        return;
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapClick' }));
    });

    map.on('load', function() {
      // Source สำหรับ stations
      map.addSource('stations', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // จุดเล็ก (zoom ไกล)
      map.addLayer({
        id: 'stations-circle',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            5, 2,
            8, 3,
            10, 4,
            12, 6,
            14, 8,
          ],
          'circle-color': ['case', ['get', 'has_fuel'], '#00e676', '#ff5252'],
          'circle-opacity': [
            'interpolate', ['linear'], ['zoom'],
            5, 0.4,
            8, 0.6,
            12, 0.9,
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
          'circle-stroke-opacity': 0.5,
        },
      });

      // Source สำหรับ user location
      map.addSource('user-location', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'user-dot',
        type: 'circle',
        source: 'user-location',
        paint: {
          'circle-radius': 8,
          'circle-color': '#0058bc',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#fff',
        },
      });

      // Radius circle source
      map.addSource('radius-circle', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'radius-fill',
        type: 'fill',
        source: 'radius-circle',
        paint: {
          'fill-color': '#0058bc',
          'fill-opacity': 0.06,
        },
      });

      map.addLayer({
        id: 'radius-line',
        type: 'line',
        source: 'radius-circle',
        paint: {
          'line-color': '#0058bc',
          'line-width': 2,
          'line-dasharray': [4, 4],
        },
      });

      // Map loaded — process pending messages
      mapLoaded = true;
      pendingMessages.forEach(function(msg) { processMessage(msg); });
      pendingMessages = [];
    });

    // Auto popup near center (ใช้ DOM createElement ไม่มี escaped quotes)
    var htmlMarkers = [];

    function showDetailMarkers() {
      htmlMarkers.forEach(function(m) { m.remove(); });
      htmlMarkers = [];

      var zoom = map.getZoom();
      if (zoom < 10) return;

      var center = map.getCenter();
      var bounds = map.getBounds();
      var visible = allStations.filter(function(s) {
        return s.lng >= bounds.getWest() && s.lng <= bounds.getEast() && s.lat >= bounds.getSouth() && s.lat <= bounds.getNorth();
      });

      function createLogoCircle(s) {
        var borderColor = s.has_fuel ? '#1b8a4a' : '#c62828';
        var el = document.createElement('div');
        el.style.cssText = 'width:24px;height:24px;background:#fff;border:2.5px solid '+borderColor+';border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:pointer';
        if (s.brand_logo) {
          var img = document.createElement('img');
          img.src = s.brand_logo;
          img.style.cssText = 'width:16px;height:16px;object-fit:contain';
          img.onerror = function() { el.textContent = '⛽'; };
          el.appendChild(img);
        } else {
          el.textContent = '⛽';
          el.style.fontSize = '10px';
        }
        el.onclick = function() { window.ReactNativeWebView.postMessage(JSON.stringify({type:'marker',id:s.id})); };
        return el;
      }

      function createFuelPopup(s) {
        var fuels = s.fuels || [];
        var borderColor = s.has_fuel ? '#1b8a4a' : '#c62828';
        var el = document.createElement('div');
        el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer';

        var popup = document.createElement('div');
        popup.className = 'fuel-popup';

        // Title row: icon + name
        var titleRow = document.createElement('div');
        titleRow.style.cssText = 'display:flex;align-items:center;gap:5px;margin-bottom:4px';

        var icon = document.createElement('div');
        icon.style.cssText = 'width:20px;height:20px;background:#fff;border:2px solid '+borderColor+';border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0';
        if (s.brand_logo) {
          var iconImg = document.createElement('img');
          iconImg.src = s.brand_logo;
          iconImg.style.cssText = 'width:14px;height:14px;object-fit:contain';
          iconImg.onerror = function() { icon.textContent = '⛽'; icon.style.fontSize = '10px'; };
          icon.appendChild(iconImg);
        } else {
          icon.textContent = '⛽';
          icon.style.fontSize = '10px';
        }
        titleRow.appendChild(icon);

        var nameDiv = document.createElement('div');
        nameDiv.className = 'fuel-popup-name';
        nameDiv.style.marginBottom = '0';
        nameDiv.textContent = s.name && s.name.length > 15 ? s.name.slice(0,15) + '…' : (s.name || 'ปั๊มน้ำมัน');
        titleRow.appendChild(nameDiv);
        popup.appendChild(titleRow);

        var grid = document.createElement('div');
        grid.className = 'fuel-popup-grid';
        fuels.forEach(function(f) {
          var tag = document.createElement('span');
          tag.className = 'fuel-tag ' + (f.is_available ? 'fuel-tag-ok' : 'fuel-tag-no');
          var label = f.fuel_type.replace('แก๊สโซฮอล์ ','').replace('ดีเซล','D');
          tag.textContent = label.length > 5 ? label.slice(0,5) : label;
          grid.appendChild(tag);
        });
        popup.appendChild(grid);
        el.appendChild(popup);
        el.onclick = function() { window.ReactNativeWebView.postMessage(JSON.stringify({type:'marker',id:s.id})); };
        return el;
      }

      if (zoom >= 10 && zoom < 12) {
        // Level 1: logo วงกลมเท่านั้น
        visible.slice(0, 200).forEach(function(s) {
          var el = createLogoCircle(s);
          var marker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([s.lng, s.lat])
            .addTo(map);
          htmlMarkers.push(marker);
        });
      } else if (zoom >= 12 && zoom < 15) {
        // Level 2: logo + fuel popup ใกล้กลาง
        var nearRadius = zoom < 13 ? 0.03 : zoom < 14 ? 0.015 : 0.008;
        var nearby = {};
        visible.filter(function(s) {
          return Math.sqrt(Math.pow(s.lat - center.lat, 2) + Math.pow(s.lng - center.lng, 2)) < nearRadius;
        }).slice(0, 8).forEach(function(s) { nearby[s.id] = true; });

        visible.slice(0, 150).forEach(function(s) {
          if (nearby[s.id]) return;
          var el = createLogoCircle(s);
          var marker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([s.lng, s.lat])
            .addTo(map);
          htmlMarkers.push(marker);
        });
        visible.forEach(function(s) {
          if (!nearby[s.id]) return;
          var el = createFuelPopup(s);
          el.style.zIndex = '999';
          var marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([s.lng, s.lat])
            .addTo(map);
          htmlMarkers.push(marker);
        });
      } else if (zoom >= 15) {
        // Level 3: fuel popup ทุกตัว
        visible.slice(0, 50).forEach(function(s) {
          var el = createFuelPopup(s);
          var marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([s.lng, s.lat])
            .addTo(map);
          htmlMarkers.push(marker);
        });
      }
    }

    map.on('moveend', showDetailMarkers);
    map.on('zoomend', showDetailMarkers);


    // สร้าง circle GeoJSON
    function createCircle(lng, lat, radiusKm) {
      var points = 64;
      var coords = [];
      for (var i = 0; i <= points; i++) {
        var angle = (i / points) * Math.PI * 2;
        var dx = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));
        var dy = radiusKm / 110.574;
        coords.push([lng + dx * Math.cos(angle), lat + dy * Math.sin(angle)]);
      }
      return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } };
    }

    // รับข้อมูลจาก React Native
    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);

    function handleMessage(event) {
      try {
        var d = JSON.parse(event.data);
        if (!mapLoaded) { pendingMessages.push(d); return; }
        processMessage(d);
      } catch(e) {}
    }

    function processMessage(d) {
      try {
        if (d.type === 'stations') {
          allStations = d.data;
          var features = d.data.map(function(s) {
            return {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
              properties: { id: s.id, has_fuel: s.has_fuel, brand: s.brand || '', name: s.name || '' },
            };
          });
          var source = map.getSource('stations');
          if (source) source.setData({ type: 'FeatureCollection', features: features });

          // Refresh fuel popups when filter changes
          showDetailMarkers();

          if (d.centerLat && d.centerLng) {
            map.flyTo({ center: [d.centerLng, d.centerLat], zoom: 12, duration: 1000 });
          }
        }

        if (d.type === 'location') {
          var userSource = map.getSource('user-location');
          if (userSource) {
            userSource.setData({
              type: 'FeatureCollection',
              features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [d.lng, d.lat] }, properties: {} }],
            });
          }

          if (d.radius > 0) {
            var circleSource = map.getSource('radius-circle');
            if (circleSource) circleSource.setData(createCircle(d.lng, d.lat, d.radius));
            var zoom = d.radius <= 5 ? 14 : d.radius <= 10 ? 13 : d.radius <= 20 ? 12 : 10;
            map.flyTo({ center: [d.lng, d.lat], zoom: zoom, duration: 1000 });
          } else {
            var circleSource2 = map.getSource('radius-circle');
            if (circleSource2) circleSource2.setData({ type: 'FeatureCollection', features: [] });
            // flyTo เฉพาะครั้งแรก ไม่เลื่อนกลับเมื่อกดปั๊ม
            if (!window._userLocated) {
              window._userLocated = true;
              map.flyTo({ center: [d.lng, d.lat], zoom: 12, duration: 1000 });
            }
          }
        }
      } catch(e) {}
    }
  </script>
</body>
</html>`, [mapTheme]);

  const sendData = () => {
    if (!webRef.current) return;
    setTimeout(() => {
      const coords = selectedProvinceName ? provinceCoords[selectedProvinceName] : null;
      webRef.current?.postMessage(JSON.stringify({
        type: 'stations',
        data: stations,
        centerLat: coords ? coords.lat : undefined,
        centerLng: coords ? coords.lng : undefined,
      }));
      if (userLat) {
        webRef.current?.postMessage(JSON.stringify({ type: 'location', lat: userLat, lng: userLng, radius: radiusKm }));
      }
    }, 1500); // รอ MapLibre load เสร็จ
  };

  useEffect(() => { sendData(); }, [stations, selectedProvinceName, mapTheme]);
  useEffect(() => {
    if (webRef.current && userLat) {
      webRef.current.postMessage(JSON.stringify({ type: 'location', lat: userLat, lng: userLng, radius: radiusKm }));
    }
  }, [userLat, userLng, radiusKm]);

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (onMarkerPress) onMarkerPress(data);
    } catch {}
  };

  return (
    <WebView
      ref={webRef}
      source={{ html }}
      style={[styles.map, style]}
      onMessage={handleMessage}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState
      mixedContentMode="always"
      androidLayerType="hardware"
      allowsInlineMediaPlayback
    />
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
