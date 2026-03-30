const prisma = require('../prismaClient');

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) { console.error('GOOGLE_API_KEY env var required'); process.exit(1); }
const FUEL_TYPES = ['ดีเซล', 'ดีเซล B7', 'แก๊สโซฮอล์ 91', 'แก๊สโซฮอล์ 95', 'แก๊สโซฮอล์ E20', 'เบนซิน 95'];

const SEARCH_LOCATIONS = [
  // มุกดาหาร - ทุกอำเภอ
  { lat: 16.5425, lng: 104.7233, name: 'มุกดาหาร เมือง' },
  { lat: 16.3611, lng: 104.6486, name: 'มุกดาหาร นิคมคำสร้อย' },
  { lat: 16.3156, lng: 104.7461, name: 'มุกดาหาร ดอนตาล' },
  { lat: 16.7500, lng: 104.4833, name: 'มุกดาหาร ดงหลวง' },
  { lat: 16.6167, lng: 104.5167, name: 'มุกดาหาร คำชะอี' },
  { lat: 16.4667, lng: 104.8000, name: 'มุกดาหาร หว้านใหญ่' },
  { lat: 16.6833, lng: 104.6333, name: 'มุกดาหาร หนองสูง' },

  // นครพนม - ทุกอำเภอ
  { lat: 17.3920, lng: 104.7697, name: 'นครพนม เมือง' },
  { lat: 17.1833, lng: 104.4333, name: 'นครพนม ปลาปาก' },
  { lat: 17.5667, lng: 104.5833, name: 'นครพนม ท่าอุเทน' },
  { lat: 18.0167, lng: 104.3667, name: 'นครพนม บ้านแพง' },
  { lat: 17.1833, lng: 104.6833, name: 'นครพนม ธาตุพนม' },
  { lat: 17.1667, lng: 104.6333, name: 'นครพนม เรณูนคร' },
  { lat: 17.3000, lng: 104.3167, name: 'นครพนม นาแก' },
  { lat: 17.5500, lng: 104.3000, name: 'นครพนม ศรีสงคราม' },
  { lat: 17.5167, lng: 104.0833, name: 'นครพนม นาหว้า' },
  { lat: 17.6167, lng: 104.5500, name: 'นครพนม โพนสวรรค์' },
  { lat: 17.8500, lng: 104.3167, name: 'นครพนม นาทม' },
  { lat: 17.3500, lng: 104.4667, name: 'นครพนม วังยาง' },
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
  return 'Other';
}

async function searchPlaces(lat, lng, pageToken = null) {
  const url = pageToken
    ? `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${pageToken}&key=${API_KEY}`
    : `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=50000&type=gas_station&language=th&key=${API_KEY}`;
  const res = await fetch(url);
  return res.json();
}

async function getDetails(placeId) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,formatted_phone_number&language=th&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.result || {};
  } catch { return {}; }
}

async function findProvinceId(lat, lng) {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=th&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.results?.[0]) {
      const province = data.results[0].address_components.find(c => c.types.includes('administrative_area_level_1'));
      if (province) {
        let name = province.long_name.replace('จังหวัด', '').trim();
        const p = await prisma.provinces.findFirst({ where: { name: { contains: name } } });
        if (p) return p.id;
      }
    }
  } catch {}
  return null;
}

async function main() {
  console.log('🚀 ดึงปั๊มน้ำมัน มุกดาหาร + นครพนม ทุกอำเภอ\n');

  const existing = await prisma.stations.findMany({ select: { lat: true, lng: true } });
  const existingSet = new Set(existing.map(s => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`));

  let totalAdded = 0, totalSkipped = 0;

  for (const loc of SEARCH_LOCATIONS) {
    console.log(`📍 ${loc.name}`);
    let pageToken = null, pageNum = 0;

    do {
      const data = await searchPlaces(loc.lat, loc.lng, pageToken);
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.log(`   ⚠️ ${data.status}`);
        break;
      }

      const results = data.results || [];
      console.log(`   หน้า ${pageNum + 1}: ${results.length} ปั๊ม`);

      for (const place of results) {
        const lat = place.geometry.location.lat;
        const lng = place.geometry.location.lng;
        const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;

        if (existingSet.has(key)) { totalSkipped++; continue; }

        const name = place.name;
        const brand = detectBrand(name);
        const details = await getDetails(place.place_id);
        const address = details.formatted_address || place.vicinity || '';
        const phone = details.formatted_phone_number || null;
        const provinceId = await findProvinceId(lat, lng);

        if (!provinceId) { console.log(`   ⏭️ ข้าม (ไม่พบจังหวัด): ${name}`); continue; }

        try {
          const station = await prisma.stations.create({
            data: { name, brand, address, province_id: provinceId, lat, lng, phone },
          });
          await prisma.fuel_status.createMany({
            data: FUEL_TYPES.map(ft => ({ station_id: station.id, fuel_type: ft, is_available: false, updated_by: 'google_import' })),
          });
          existingSet.add(key);
          totalAdded++;
          console.log(`   ✅ ${name} (${brand}) ${phone ? '📞' + phone : ''}`);
          console.log(`      ${address}`);
        } catch (e) {
          console.log(`   ❌ ${name}: ${e.message}`);
        }
      }

      pageToken = data.next_page_token || null;
      pageNum++;
      if (pageToken) await new Promise(r => setTimeout(r, 2000));
    } while (pageToken && pageNum < 3);

    console.log('');
  }

  console.log('========================================');
  console.log(`✅ เพิ่มใหม่: ${totalAdded} ปั๊ม`);
  console.log(`⏭️ ข้าม (ซ้ำ): ${totalSkipped} ปั๊ม`);

  const totalMuk = await prisma.stations.count({ where: { provinces: { name: 'มุกดาหาร' } } });
  const totalNkp = await prisma.stations.count({ where: { provinces: { name: 'นครพนม' } } });
  console.log(`\nมุกดาหาร: ${totalMuk} ปั๊ม`);
  console.log(`นครพนม: ${totalNkp} ปั๊ม`);
  console.log('========================================');

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
