import { useState, useEffect } from 'react';
import { fetchStationsDots, fetchStationsStatus, fetchProvinces, fetchBrands } from '../utils/api';
import { getDistance } from '../utils/helpers';

export default function useStations() {
  const [stations, setStations] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedFuelTypes, setSelectedFuelTypes] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [viewMode, setViewMode] = useState('all');
  const [radius, setRadius] = useState(0);

  useEffect(() => {
    fetchProvinces().then(setProvinces);
    fetchBrands().then(r => Array.isArray(r) ? setBrands(r.map(b => b.name)) : null);
  }, []);

  useEffect(() => {
    setLoading(true);
    if (selectedProvince) {
      fetchStationsStatus(selectedProvince).then(data => { setStations(data); setLoading(false); });
    } else {
      fetchStationsDots().then(data => { setStations(data); setLoading(false); });
    }
  }, [selectedProvince]);

  const fuelTypes = [...new Set(stations.flatMap(s => s.fuels?.map(f => f.fuel_type) || []))].sort();
  const brandList = [...new Set(stations.map(s => s.brand))].sort();

  const filter = (userLat, userLng) => {
    return stations.filter(s => {
      if (radius > 0 && userLat && userLng && getDistance(userLat, userLng, s.lat, s.lng) > radius) return false;
      if (selectedBrands.length > 0 && !selectedBrands.includes(s.brand)) return false;
      if (selectedFuelTypes.length > 0 && !selectedFuelTypes.some(ft => s.fuels?.some(f => f.fuel_type === ft && f.is_available))) return false;
      if (viewMode === 'available' && !s.has_fuel) return false;
      if (viewMode === 'empty' && s.has_fuel) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        return (s.name || '').toLowerCase().includes(q) || (s.address || '').toLowerCase().includes(q) || (s.brand || '').toLowerCase().includes(q) || (s.province_name || '').toLowerCase().includes(q);
      }
      return true;
    }).map(s => ({ ...s, _distance: userLat ? getDistance(userLat, userLng, s.lat, s.lng) : null }))
      .sort((a, b) => (a._distance ?? 999) - (b._distance ?? 999));
  };

  return {
    stations, provinces, brands: brandList, fuelTypes, loading,
    selectedProvince, setSelectedProvince,
    selectedBrands, setSelectedBrands,
    selectedFuelTypes, setSelectedFuelTypes,
    searchText, setSearchText,
    viewMode, setViewMode,
    radius, setRadius,
    filter,
  };
}
