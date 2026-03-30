import { useState } from 'react';

export default function useLocation() {
  const [userLat, setUserLat] = useState(null);
  const [userLng, setUserLng] = useState(null);
  const [locating, setLocating] = useState(false);

  const locateMe = (onLocated) => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setLocating(false);
        onLocated?.(pos.coords.latitude, pos.coords.longitude);
      },
      () => { setLocating(false); },
      { enableHighAccuracy: true }
    );
  };

  return { userLat, userLng, locating, locateMe };
}
