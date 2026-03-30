const prisma = require('../prismaClient');
const fs = require('fs');

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) { console.error('GOOGLE_API_KEY env var required'); process.exit(1); }
const FUEL_TYPES = ['ดีเซล', 'ดีเซล B7', 'แก๊สโซฮอล์ 91', 'แก๊สโซฮอล์ 95', 'แก๊สโซฮอล์ E20', 'เบนซิน 95'];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function detectBrand(name, brand, operator) {
  const all = `${name} ${brand} ${operator}`.toLowerCase();
  if (all.includes('ปตท') || all.includes('ptt') || all.includes('ป.ต.ท')) return 'PTT';
  if (all.match(/\bpt\b/) || all.includes('พีที')) return 'PT';
  if (all.includes('บางจาก') || all.includes('bangchak')) return 'Bangchak';
  if (all.includes('เชลล์') || all.includes('shell')) return 'Shell';
  if (all.includes('เอสโซ่') || all.includes('esso')) return 'Esso';
  if (all.includes('คาลเท็กซ์') || all.includes('caltex')) return 'Caltex';
  if (all.includes('ซัสโก้') || all.includes('susco')) return 'Susco';
  if (all.includes('irpc') || all.includes('ไออาร์พีซี')) return 'IRPC';
  if (all.includes('เพียว') || all.includes('pure')) return 'Pure';
  if (all.includes('thaioil') || all.includes('ไทยออยล์')) return 'Thaioil';
  return 'Other';
}

async function reverseGeocode(lat, lng) {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=th&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.results?.[0]) {
      const comp = data.results[0].address_components;
      const province = comp?.find(c => c.types.includes('administrative_area_level_1'));
      const district = comp?.find(c => c.types.includes('administrative_area_level_2'));
      const subdistrict = comp?.find(c => c.types.includes('locality') || c.types.includes('administrative_area_level_3'));
      let provName = province?.long_name?.replace('จังหวัด', '').trim() || '';
      if (provName.includes('กรุงเทพ')) provName = 'กรุงเทพมหานคร';
      return {
        province: provName,
        district: district?.long_name || '',
        subdistrict: subdistrict?.long_name || '',
        address: data.results[0].formatted_address || '',
      };
    }
  } catch {}
  return null;
}

async function main() {
  console.log('🚀 Import ปั๊มจาก OpenStreetMap + Google Geocode\n');

  // Step 1: โหลด OSM data
  let elements;
  const cacheFile = __dirname + '/osm-raw.json';
  if (fs.existsSync(cacheFile)) {
    console.log('📂 ใช้ cache osm-raw.json');
    elements = JSON.parse(fs.readFileSync(cacheFile)).elements;
  } else {
    console.log('🌐 ดึงจาก Overpass API...');
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=[out:json][timeout:120];area["ISO3166-1"="TH"]->.thailand;(node["amenity"="fuel"](area.thailand);way["amenity"="fuel"](area.thailand););out center body;',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const data = await res.json();
    elements = data.elements;
    fs.writeFileSync(cacheFile, JSON.stringify(data));
    console.log(`📥 ดึงได้ ${elements.length} รายการ`);
  }

  console.log(`📊 OSM ทั้งหมด: ${elements.length}\n`);

  // Step 2: เตรียม provinces
  const provCache = {};
  async function getProvinceId(provName) {
    if (!provName) return null;
    if (provCache[provName]) return provCache[provName];
    let p = await prisma.provinces.findFirst({ where: { name: { contains: provName } } });
    if (!p) p = await prisma.provinces.create({ data: { name: provName } });
    provCache[provName] = p.id;
    return p.id;
  }

  // Step 3: Import
  const existing = await prisma.stations.findMany({ select: { lat: true, lng: true } });
  const existingSet = new Set(existing.map(s => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`));

  let added = 0, skipped = 0, needGeocode = 0;
  const geocodeCache = {};

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const lat = el.lat || el.center?.lat;
    const lng = el.lon || el.center?.lon;
    if (!lat || !lng) continue;

    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (existingSet.has(key)) { skipped++; continue; }

    const tags = el.tags || {};
    let name = tags.name || tags['name:th'] || '';
    const brand = tags.brand || tags['brand:th'] || '';
    const operator = tags.operator || '';
    const detectedBrand = detectBrand(name, brand, operator);

    // ถ้าไม่มีชื่อ ใช้ brand + geocode
    if (!name) {
      name = detectedBrand !== 'Other' ? detectedBrand : 'ปั๊มน้ำมัน';
    }

    // Geocode หาจังหวัด + ที่อยู่ (cache by area)
    const areaKey = `${(lat*5).toFixed(0)},${(lng*5).toFixed(0)}`;
    if (!geocodeCache[areaKey]) {
      geocodeCache[areaKey] = await reverseGeocode(lat, lng);
      needGeocode++;
      if (needGeocode % 50 === 0) await sleep(500);
    }
    const geo = geocodeCache[areaKey];
    const provinceId = geo ? await getProvinceId(geo.province) : null;

    // ตั้งชื่อให้ดี
    if (name === 'ปั๊มน้ำมัน' || name === 'Fuel Station' || name === 'fuel') {
      const area = geo?.subdistrict || geo?.district || '';
      name = detectedBrand !== 'Other' ? `${detectedBrand} ${area}`.trim() : `ปั๊มน้ำมัน ${area}`.trim();
    }

    const address = geo?.address || tags['addr:full'] || '';

    try {
      const station = await prisma.stations.create({
        data: {
          name,
          brand: detectedBrand,
          address,
          province_id: provinceId || 1,
          lat,
          lng,
          phone: tags.phone || tags['contact:phone'] || null,
        },
      });

      await prisma.fuel_status.createMany({
        data: FUEL_TYPES.map(ft => ({
          station_id: station.id,
          fuel_type: ft,
          is_available: Math.random() < 0.7,
          remaining_cars: Math.random() < 0.7 ? Math.floor(Math.random() * 200) + 10 : null,
          updated_by: 'osm_import',
        })),
      });

      existingSet.add(key);
      added++;

      if (added % 100 === 0) {
        console.log(`[${added}/${elements.length}] ${name} (${detectedBrand}) — ${geo?.province || '?'}`);
      }
    } catch {}
  }

  console.log(`\n🏁 เสร็จสิ้น!`);
  console.log(`   เพิ่มใหม่: ${added}`);
  console.log(`   ซ้ำ (ข้าม): ${skipped}`);
  console.log(`   Geocode calls: ${needGeocode}`);
  console.log(`   รวมในระบบ: ${await prisma.stations.count()}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
