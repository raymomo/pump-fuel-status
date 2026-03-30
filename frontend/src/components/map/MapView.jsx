import { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';
const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export default function MapView({ stations, userLat, userLng, radiusKm, onStationClick, onMapClick, theme = 'light' }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const showDetailMarkersRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const userLocatedRef = useRef(false);
  const stationsRef = useRef(stations);
  const onStationClickRef = useRef(onStationClick);

  // Keep refs in sync
  useEffect(() => { stationsRef.current = stations; }, [stations]);
  useEffect(() => { onStationClickRef.current = onStationClick; }, [onStationClick]);

  // สร้าง map
  useEffect(() => {
    if (!mapContainer.current) return;

    // StrictMode: reuse if container still in DOM
    if (mapRef.current) {
      try {
        const container = mapRef.current.getContainer();
        if (container && container.parentNode) return; // still valid
      } catch (e) {}
      // old map's container gone — clean up silently
      try { mapRef.current.remove(); } catch (e) {}
      mapRef.current = null;
      setMapReady(false);
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: theme === 'dark' ? DARK_STYLE : LIGHT_STYLE,
      center: [100.50, 13.75],
      zoom: 9,
      attributionControl: false,
      dragRotate: false,
      touchPitch: false,
      pitchWithRotate: false,
    });

    // Suppress style load errors (StrictMode race condition)
    map.on('error', (e) => { if (e?.error?.message?.includes('projection')) e.preventDefault?.(); });

    map.touchZoomRotate?.disableRotation?.();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      map.addSource('stations', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'stations-circle',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 2, 8, 3, 10, 4, 12, 6, 14, 8],
          'circle-color': ['case', ['get', 'has_fuel'], '#00e676', '#ff5252'],
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 8, 0.6, 12, 0.9],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
          'circle-stroke-opacity': 0.5,
        },
      });

      map.addSource('user-location', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'user-dot', type: 'circle', source: 'user-location',
        paint: { 'circle-radius': 8, 'circle-color': '#0058bc', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' },
      });

      map.addSource('radius-circle', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius-circle', paint: { 'fill-color': '#0058bc', 'fill-opacity': 0.06 } });
      map.addLayer({ id: 'radius-line', type: 'line', source: 'radius-circle', paint: { 'line-color': '#0058bc', 'line-width': 2, 'line-dasharray': [4, 4] } });

      setMapReady(true);
    });

    map.on('click', 'stations-circle', (e) => {
      if (e.features?.length > 0) {
        const id = e.features[0].properties.id;
        onStationClickRef.current?.(id);
      }
    });

    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['stations-circle'] });
      if (features.length === 0) onMapClick?.();
    });

    map.on('mouseenter', 'stations-circle', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'stations-circle', () => { map.getCanvas().style.cursor = ''; });

    // Detail markers
    const showDetailMarkers = () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      const zoom = map.getZoom();
      if (zoom < 10) return;

      const bounds = map.getBounds();
      const allStations = stationsRef.current || [];
      const visible = allStations.filter(s =>
        s.lng >= bounds.getWest() && s.lng <= bounds.getEast() &&
        s.lat >= bounds.getSouth() && s.lat <= bounds.getNorth()
      );

      const center = map.getCenter();

      const createFuelPopup = (s) => {
        const fuels = s.fuels || [];
        const isLight = theme !== 'dark';
        const borderColor = s.has_fuel ? '#1b8a4a' : '#c62828';
        const el = document.createElement('div');
        el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer';

        const popup = document.createElement('div');
        popup.style.cssText = isLight
          ? 'background:rgba(255,255,255,0.95);border-radius:8px;padding:6px 8px;box-shadow:0 2px 8px rgba(0,0,0,0.15);min-width:80px;border:1px solid #e5e7eb'
          : 'background:rgba(30,30,30,0.92);border-radius:8px;padding:6px 8px;box-shadow:0 2px 8px rgba(0,0,0,0.4);min-width:80px';

        // Title row: icon + name
        const titleRow = document.createElement('div');
        titleRow.style.cssText = 'display:flex;align-items:center;gap:5px;margin-bottom:4px';

        const icon = document.createElement('div');
        icon.style.cssText = `width:20px;height:20px;background:#fff;border:2px solid ${borderColor};border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0`;
        if (s.brand_logo) {
          const img = document.createElement('img');
          img.src = s.brand_logo;
          img.style.cssText = 'width:14px;height:14px;object-fit:contain';
          img.onerror = () => { icon.textContent = '⛽'; icon.style.fontSize = '10px'; };
          icon.appendChild(img);
        } else {
          icon.textContent = '⛽';
          icon.style.fontSize = '10px';
        }
        titleRow.appendChild(icon);

        const nameDiv = document.createElement('div');
        nameDiv.style.cssText = isLight
          ? 'font-size:11px;font-weight:700;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px'
          : 'font-size:11px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px';
        nameDiv.textContent = s.name?.length > 15 ? s.name.slice(0, 15) + '…' : (s.name || 'ปั๊มน้ำมัน');
        titleRow.appendChild(nameDiv);
        popup.appendChild(titleRow);

        const grid = document.createElement('div');
        grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:2px';
        fuels.forEach(f => {
          const tag = document.createElement('span');
          tag.style.cssText = isLight
            ? `font-size:9px;font-weight:700;padding:2px 5px;border-radius:3px;background:${f.is_available ? '#dcfce7' : '#f3f4f6'};color:${f.is_available ? '#166534' : '#9ca3af'}`
            : `font-size:9px;font-weight:700;padding:2px 5px;border-radius:3px;background:${f.is_available ? '#1b8a4a' : '#444'};color:${f.is_available ? '#fff' : '#888'}`;
          let label = f.fuel_type.replace('แก๊สโซฮอล์ ', '').replace('ดีเซล', 'D');
          tag.textContent = label.length > 5 ? label.slice(0, 5) : label;
          grid.appendChild(tag);
        });
        popup.appendChild(grid);
        el.appendChild(popup);
        el.onclick = (e) => { e.stopPropagation(); onStationClickRef.current?.(s.id); };
        return el;
      };

      const createLogoCircle = (s) => {
        const borderColor = s.has_fuel ? '#1b8a4a' : '#c62828';
        const el = document.createElement('div');
        el.style.cssText = `width:24px;height:24px;background:#fff;border:2.5px solid ${borderColor};border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:pointer`;
        if (s.brand_logo) {
          const img = document.createElement('img');
          img.src = s.brand_logo;
          img.style.cssText = 'width:16px;height:16px;object-fit:contain';
          img.onerror = () => { el.textContent = '⛽'; };
          el.appendChild(img);
        } else {
          el.textContent = '⛽';
          el.style.fontSize = '10px';
        }
        el.onclick = (e) => { e.stopPropagation(); onStationClickRef.current?.(s.id); };
        return el;
      };

      if (zoom >= 10 && zoom < 12) {
        // Level 1: logo วงกลมเท่านั้น
        visible.slice(0, 200).forEach(s => {
          const marker = new maplibregl.Marker({ element: createLogoCircle(s), anchor: 'center' })
            .setLngLat([s.lng, s.lat]).addTo(map);
          markersRef.current.push(marker);
        });
      } else if (zoom >= 12 && zoom < 15) {
        // Level 2: logo + fuel popup ใกล้กลาง
        const nearRadius = zoom < 13 ? 0.03 : zoom < 14 ? 0.015 : 0.008;
        const nearby = {};
        visible.filter(s => Math.sqrt(Math.pow(s.lat - center.lat, 2) + Math.pow(s.lng - center.lng, 2)) < nearRadius)
          .slice(0, 8).forEach(s => { nearby[s.id] = true; });

        visible.slice(0, 150).forEach(s => {
          if (nearby[s.id]) return;
          const marker = new maplibregl.Marker({ element: createLogoCircle(s), anchor: 'center' })
            .setLngLat([s.lng, s.lat]).addTo(map);
          markersRef.current.push(marker);
        });
        visible.forEach(s => {
          if (!nearby[s.id]) return;
          const el = createFuelPopup(s);
          el.style.zIndex = '999';
          const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([s.lng, s.lat]).addTo(map);
          markersRef.current.push(marker);
        });
      } else if (zoom >= 15) {
        // Level 3: fuel popup ทุกตัว
        visible.slice(0, 50).forEach(s => {
          const marker = new maplibregl.Marker({ element: createFuelPopup(s), anchor: 'bottom' })
            .setLngLat([s.lng, s.lat]).addTo(map);
          markersRef.current.push(marker);
        });
      }
    };

    map.on('moveend', showDetailMarkers);
    map.on('zoomend', showDetailMarkers);
    showDetailMarkersRef.current = showDetailMarkers;

    mapRef.current = map;

    return () => {
      // Don't destroy on StrictMode remount — only on real unmount
    };
  }, [theme]);

  // Cleanup on real unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(m => { try { m.remove(); } catch (e) {} });
      markersRef.current = [];
      if (mapRef.current) {
        if (showDetailMarkersRef.current) {
          try {
            mapRef.current.off('moveend', showDetailMarkersRef.current);
            mapRef.current.off('zoomend', showDetailMarkersRef.current);
          } catch (e) {}
        }
        try { mapRef.current.remove(); } catch (e) {}
        mapRef.current = null;
      }
    };
  }, []);

  // Update stations
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const source = map.getSource('stations');
    if (!source) return;

    const features = (stations || []).map(s => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: { id: s.id, has_fuel: !!s.has_fuel, brand: s.brand || '', name: s.name || '' },
    }));
    source.setData({ type: 'FeatureCollection', features });

    // Refresh detail markers (fuel popups) when stations change
    if (showDetailMarkersRef.current) showDetailMarkersRef.current();
  }, [stations, mapReady]);

  // Update user location
  useEffect(() => {
    if (!mapReady || !mapRef.current || !userLat) return;
    const map = mapRef.current;

    const userSource = map.getSource('user-location');
    if (userSource) {
      userSource.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [userLng, userLat] }, properties: {} }],
      });
    }

    const circleSource = map.getSource('radius-circle');
    if (radiusKm > 0 && circleSource) {
      const points = 64;
      const coords = [];
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const dx = radiusKm / (111.32 * Math.cos(userLat * Math.PI / 180));
        const dy = radiusKm / 110.574;
        coords.push([userLng + dx * Math.cos(angle), userLat + dy * Math.sin(angle)]);
      }
      circleSource.setData({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } });
      const zoom = radiusKm <= 5 ? 14 : radiusKm <= 10 ? 13 : radiusKm <= 20 ? 12 : 10;
      map.flyTo({ center: [userLng, userLat], zoom, duration: 1000 });
    } else if (circleSource) {
      circleSource.setData({ type: 'FeatureCollection', features: [] });
      if (!userLocatedRef.current) {
        userLocatedRef.current = true;
        map.flyTo({ center: [userLng, userLat], zoom: 12, duration: 1000 });
      }
    }
  }, [userLat, userLng, radiusKm, mapReady]);

  return <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />;
}
