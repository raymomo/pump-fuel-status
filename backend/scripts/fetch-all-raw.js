const fs = require('fs');

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) { console.error('GOOGLE_API_KEY env var required'); process.exit(1); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function searchPlaces(lat, lng, pageToken = null) {
  const url = pageToken
    ? `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${pageToken}&key=${API_KEY}`
    : `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=25000&type=gas_station&language=th&key=${API_KEY}`;
  const res = await fetch(url);
  return res.json();
}

async function getDetails(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,types,rating,user_ratings_total&language=th&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.result || null;
}

async function main() {
  console.log('🚀 ดึงข้อมูลปั๊มทั้งหมดจาก Google Places...\n');

  // Grid ทุก 0.2 องศา ครอบประเทศไทย
  const grid = [];
  for (let lat = 5.6; lat <= 20.5; lat += 0.2) {
    for (let lng = 97.3; lng <= 105.7; lng += 0.2) {
      grid.push([parseFloat(lat.toFixed(1)), parseFloat(lng.toFixed(1))]);
    }
  }
  console.log(`📐 Grid: ${grid.length} จุด\n`);

  const seen = new Set();
  const allStations = [];

  for (let gi = 0; gi < grid.length; gi++) {
    const [lat, lng] = grid[gi];
    let pageToken = null, pageNum = 0;

    do {
      const data = await searchPlaces(lat, lng, pageToken);
      if (data.status !== 'OK') break;

      for (const place of data.results || []) {
        const key = place.place_id;
        if (seen.has(key)) continue;
        seen.add(key);

        // ดึง details
        let details = null;
        try { details = await getDetails(place.place_id); } catch {}

        allStations.push({
          place_id: place.place_id,
          name_search: place.name,
          name_detail: details?.name || null,
          address: details?.formatted_address || place.vicinity || '',
          phone: details?.formatted_phone_number || null,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          types: place.types || [],
          rating: details?.rating || place.rating || null,
          reviews: details?.user_ratings_total || place.user_ratings_total || 0,
        });

        console.log(`[${allStations.length}] ${details?.name || place.name} | ${place.vicinity || ''}`);
      }

      pageToken = data.next_page_token || null;
      pageNum++;
      if (pageToken) await sleep(2500);
    } while (pageToken && pageNum < 3);

    if ((gi+1) % 100 === 0) {
      console.log(`\n--- Progress: ${gi+1}/${grid.length} | Found: ${allStations.length} ---\n`);
      // บันทึกระหว่างทาง
      fs.writeFileSync('scripts/raw-stations.json', JSON.stringify(allStations, null, 2));
    }
  }

  fs.writeFileSync('scripts/raw-stations.json', JSON.stringify(allStations, null, 2));
  console.log(`\n🏁 เสร็จ! ดึงได้ ${allStations.length} รายการ → scripts/raw-stations.json`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
