const prisma = require('../prismaClient');

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) { console.error('GOOGLE_API_KEY env var required'); process.exit(1); }
const FUEL_TYPES = ['ดีเซล', 'ดีเซล B7', 'แก๊สโซฮอล์ 91', 'แก๊สโซฮอล์ 95', 'แก๊สโซฮอล์ E20', 'เบนซิน 95'];

// Major cities/areas to search (cover all Thailand)
const SEARCH_LOCATIONS = [
  { lat: 13.7563, lng: 100.5018, name: 'กรุงเทพ กลาง' },
  { lat: 13.85, lng: 100.65, name: 'กรุงเทพ เหนือ-ตะวันออก' },
  { lat: 13.65, lng: 100.45, name: 'กรุงเทพ ใต้-ตะวันตก' },
  { lat: 13.9, lng: 100.5, name: 'นนทบุรี/ปทุมธานี' },
  { lat: 13.36, lng: 100.98, name: 'ชลบุรี' },
  { lat: 12.93, lng: 100.88, name: 'พัทยา' },
  { lat: 14.35, lng: 100.58, name: 'อยุธยา' },
  { lat: 14.97, lng: 102.1, name: 'นครราชสีมา' },
  { lat: 16.43, lng: 102.83, name: 'ขอนแก่น' },
  { lat: 17.42, lng: 102.78, name: 'อุดรธานี' },
  { lat: 14.88, lng: 100.12, name: 'นครสวรรค์' },
  { lat: 16.82, lng: 100.26, name: 'พิษณุโลก' },
  { lat: 18.79, lng: 98.98, name: 'เชียงใหม่' },
  { lat: 19.91, lng: 99.83, name: 'เชียงราย' },
  { lat: 18.29, lng: 99.5, name: 'ลำปาง' },
  { lat: 7.89, lng: 98.39, name: 'ภูเก็ต' },
  { lat: 7.01, lng: 100.47, name: 'สงขลา/หาดใหญ่' },
  { lat: 9.14, lng: 99.33, name: 'สุราษฎร์ธานี' },
  { lat: 8.43, lng: 99.96, name: 'นครศรีธรรมราช' },
  { lat: 8.06, lng: 98.92, name: 'กระบี่' },
  { lat: 12.61, lng: 102.1, name: 'จันทบุรี' },
  { lat: 13.12, lng: 100.92, name: 'ระยอง' },
  { lat: 15.23, lng: 104.86, name: 'อุบลราชธานี' },
  { lat: 14.02, lng: 99.53, name: 'กาญจนบุรี' },
  { lat: 13.53, lng: 99.81, name: 'ราชบุรี' },
  { lat: 11.81, lng: 99.8, name: 'ประจวบคีรีขันธ์' },
  { lat: 15.87, lng: 100.99, name: 'เพชรบูรณ์' },
  { lat: 16.44, lng: 104.76, name: 'มุกดาหาร' },
  { lat: 17.41, lng: 104.78, name: 'นครพนม' },
];

function detectBrand(name) {
  const n = name.toLowerCase();
  if (n.includes('ปตท') || n.includes('ptt')) return 'PTT';
  if (n.includes('pt ') || n.includes('พีที')) return 'PT';
  if (n.includes('บางจาก') || n.includes('bangchak')) return 'Bangchak';
  if (n.includes('เชลล์') || n.includes('shell')) return 'Shell';
  if (n.includes('เอสโซ่') || n.includes('esso')) return 'Esso';
  if (n.includes('คาลเท็กซ์') || n.includes('caltex')) return 'Caltex';
  if (n.includes('ซัสโก้') || n.includes('susco')) return 'Susco';
  if (n.includes('irpc') || n.includes('ไออาร์พีซี')) return 'IRPC';
  if (n.includes('เพียว') || n.includes('pure')) return 'Pure';
  if (n.includes('thaioil') || n.includes('ไทยออยล์')) return 'Thaioil';
  return 'Other';
}

async function searchPlaces(lat, lng, pageToken = null) {
  const url = pageToken
    ? `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${pageToken}&key=${API_KEY}`
    : `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=30000&type=gas_station&language=th&key=${API_KEY}`;

  const res = await fetch(url);
  const data = await res.json();
  return data;
}

async function findProvinceId(lat, lng) {
  // Simple province matching by nearest station's province or default
  // Use reverse geocoding
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=th&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const components = data.results[0].address_components;
      const province = components.find(c => c.types.includes('administrative_area_level_1'));
      if (province) {
        let provName = province.long_name.replace('จังหวัด', '').trim();
        if (provName === 'กรุงเทพมหานคร' || provName.includes('กรุงเทพ')) provName = 'กรุงเทพมหานคร';
        const p = await prisma.provinces.findFirst({ where: { name: { contains: provName } } });
        if (p) return p.id;
      }
    }
  } catch {}
  return 1; // default กรุงเทพ
}

async function main() {
  console.log('🚀 เริ่มดึงข้อมูลปั๊มน้ำมันจาก Google Places...\n');

  const existingStations = await prisma.stations.findMany({ select: { lat: true, lng: true } });
  const existingSet = new Set(existingStations.map(s => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`));

  let totalAdded = 0;
  let totalSkipped = 0;

  for (const loc of SEARCH_LOCATIONS) {
    console.log(`📍 ค้นหา: ${loc.name} (${loc.lat}, ${loc.lng})`);

    let pageToken = null;
    let pageNum = 0;

    do {
      const data = await searchPlaces(loc.lat, loc.lng, pageToken);

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.log(`   ⚠️ Error: ${data.status} - ${data.error_message || ''}`);
        break;
      }

      const results = data.results || [];
      console.log(`   หน้า ${pageNum + 1}: พบ ${results.length} ปั๊ม`);

      for (const place of results) {
        const lat = place.geometry.location.lat;
        const lng = place.geometry.location.lng;
        const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;

        if (existingSet.has(key)) {
          totalSkipped++;
          continue;
        }

        const name = place.name;
        const brand = detectBrand(name);
        const provinceId = await findProvinceId(lat, lng);

        // Get full details (phone, formatted address)
        let address = place.vicinity || '';
        let phone = null;
        try {
          const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_address,formatted_phone_number&language=th&key=${API_KEY}`;
          const detailRes = await fetch(detailUrl);
          const detailData = await detailRes.json();
          if (detailData.result) {
            address = detailData.result.formatted_address || address;
            phone = detailData.result.formatted_phone_number || null;
          }
        } catch {}

        try {
          const station = await prisma.stations.create({
            data: { name, brand, address, province_id: provinceId, lat, lng, phone },
          });

          // Add default fuel types
          await prisma.fuel_status.createMany({
            data: FUEL_TYPES.map(ft => ({
              station_id: station.id, fuel_type: ft, is_available: false, updated_by: 'google_import',
            })),
          });

          existingSet.add(key);
          totalAdded++;
          console.log(`   ✅ เพิ่ม: ${name} (${brand}) - ${address} ${phone ? '📞' + phone : ''}`);
        } catch (e) {
          console.log(`   ❌ ข้าม: ${name} - ${e.message}`);
        }
      }

      pageToken = data.next_page_token || null;
      pageNum++;

      // Google requires delay before using next_page_token
      if (pageToken) await new Promise(r => setTimeout(r, 2000));

    } while (pageToken && pageNum < 3);

    console.log('');
  }

  console.log('========================================');
  console.log(`✅ เพิ่มใหม่: ${totalAdded} ปั๊ม`);
  console.log(`⏭️ ข้าม (ซ้ำ): ${totalSkipped} ปั๊ม`);
  console.log('========================================');

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
