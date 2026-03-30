const prisma = require('../prismaClient');

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) { console.error('GOOGLE_API_KEY env var required'); process.exit(1); }
const FUEL_TYPES = ['ดีเซล', 'ดีเซล B7', 'แก๊สโซฮอล์ 91', 'แก๊สโซฮอล์ 95', 'แก๊สโซฮอล์ E20', 'เบนซิน 95'];

// คำที่บ่งบอกว่าไม่ใช่ปั๊ม
const BLACKLIST = ['โรงงาน','โรงบรรจุ','สำนักงาน','น้ำมันพืช','ปาล์มออยล์','หุงต้ม','เปลี่ยนถ่าย','ซ่อม','ล้างรถ','car wash','workshop','garage','big c','bigc','tesco','makro','โลตัส','7-eleven','เซเว่น','safari','ซาฟารี','ร้านค้า','ร้านขาย','oil shop','ร้านน้ำมัน','น้ำมันเครื่อง'];

// คำที่บ่งบอกว่าเป็นปั๊มจริง
const WHITELIST = ['ปั๊ม','ปั้ม','สถานี','station','ptt','shell','bangchak','บางจาก','caltex','คาลเท็กซ์','esso','เอสโซ่','pt ','พีที','susco','ซัสโก้','irpc','pure','เพียว','thaioil'];

const PROVINCES = [
  { name: 'กรุงเทพมหานคร', points: [[13.75,100.50],[13.85,100.65],[13.65,100.45],[13.80,100.35]] },
  { name: 'นนทบุรี', points: [[13.86,100.51]] },
  { name: 'ปทุมธานี', points: [[14.02,100.53]] },
  { name: 'สมุทรปราการ', points: [[13.59,100.60]] },
  { name: 'นครปฐม', points: [[13.82,100.06]] },
  { name: 'สมุทรสาคร', points: [[13.55,100.27]] },
  { name: 'สมุทรสงคราม', points: [[13.41,100.00]] },
  { name: 'ชลบุรี', points: [[13.36,100.98],[12.93,100.88]] },
  { name: 'ระยอง', points: [[12.68,101.28]] },
  { name: 'จันทบุรี', points: [[12.61,102.10]] },
  { name: 'ตราด', points: [[12.24,102.52]] },
  { name: 'ฉะเชิงเทรา', points: [[13.69,101.07]] },
  { name: 'ปราจีนบุรี', points: [[14.05,101.37]] },
  { name: 'สระแก้ว', points: [[13.82,102.07]] },
  { name: 'นครนายก', points: [[14.21,101.21]] },
  { name: 'อยุธยา', points: [[14.35,100.58]] },
  { name: 'อ่างทอง', points: [[14.59,100.45]] },
  { name: 'ลพบุรี', points: [[14.80,100.65]] },
  { name: 'สิงห์บุรี', points: [[14.89,100.40]] },
  { name: 'ชัยนาท', points: [[15.19,100.13]] },
  { name: 'สระบุรี', points: [[14.53,100.91]] },
  { name: 'นครราชสีมา', points: [[14.97,102.10],[14.88,102.80]] },
  { name: 'บุรีรัมย์', points: [[14.99,103.10]] },
  { name: 'สุรินทร์', points: [[14.88,103.49]] },
  { name: 'ศรีสะเกษ', points: [[15.12,104.33]] },
  { name: 'อุบลราชธานี', points: [[15.23,104.86]] },
  { name: 'ยโสธร', points: [[15.79,104.15]] },
  { name: 'ชัยภูมิ', points: [[15.81,102.03]] },
  { name: 'อำนาจเจริญ', points: [[15.86,104.63]] },
  { name: 'หนองบัวลำภู', points: [[17.20,102.44]] },
  { name: 'ขอนแก่น', points: [[16.43,102.83]] },
  { name: 'อุดรธานี', points: [[17.42,102.78]] },
  { name: 'เลย', points: [[17.49,101.72]] },
  { name: 'หนองคาย', points: [[17.88,102.74]] },
  { name: 'มหาสารคาม', points: [[16.18,103.30]] },
  { name: 'ร้อยเอ็ด', points: [[16.05,103.65]] },
  { name: 'กาฬสินธุ์', points: [[16.43,103.51]] },
  { name: 'สกลนคร', points: [[17.16,104.15]] },
  { name: 'นครพนม', points: [[17.41,104.78]] },
  { name: 'มุกดาหาร', points: [[16.54,104.72]] },
  { name: 'บึงกาฬ', points: [[18.36,103.65]] },
  { name: 'เชียงใหม่', points: [[18.79,98.98],[18.50,99.00]] },
  { name: 'เชียงราย', points: [[19.91,99.83]] },
  { name: 'ลำพูน', points: [[18.57,99.01]] },
  { name: 'ลำปาง', points: [[18.29,99.50]] },
  { name: 'อุตรดิตถ์', points: [[17.63,100.10]] },
  { name: 'แพร่', points: [[18.14,100.14]] },
  { name: 'น่าน', points: [[18.78,100.77]] },
  { name: 'พะเยา', points: [[19.17,99.90]] },
  { name: 'แม่ฮ่องสอน', points: [[19.30,97.97]] },
  { name: 'นครสวรรค์', points: [[15.70,100.12]] },
  { name: 'อุทัยธานี', points: [[15.38,100.02]] },
  { name: 'กำแพงเพชร', points: [[16.48,99.52]] },
  { name: 'ตาก', points: [[16.88,99.13]] },
  { name: 'สุโขทัย', points: [[17.01,99.82]] },
  { name: 'พิษณุโลก', points: [[16.82,100.26]] },
  { name: 'พิจิตร', points: [[16.44,100.35]] },
  { name: 'เพชรบูรณ์', points: [[16.42,101.16]] },
  { name: 'ราชบุรี', points: [[13.53,99.81]] },
  { name: 'กาญจนบุรี', points: [[14.02,99.53]] },
  { name: 'สุพรรณบุรี', points: [[14.47,100.12]] },
  { name: 'เพชรบุรี', points: [[13.11,99.95]] },
  { name: 'ประจวบคีรีขันธ์', points: [[11.81,99.80]] },
  { name: 'ชุมพร', points: [[10.49,99.18]] },
  { name: 'ระนอง', points: [[9.97,98.64]] },
  { name: 'สุราษฎร์ธานี', points: [[9.14,99.33]] },
  { name: 'พังงา', points: [[8.45,98.52]] },
  { name: 'ภูเก็ต', points: [[7.89,98.39]] },
  { name: 'กระบี่', points: [[8.06,98.92]] },
  { name: 'นครศรีธรรมราช', points: [[8.43,99.96]] },
  { name: 'ตรัง', points: [[7.56,99.61]] },
  { name: 'พัทลุง', points: [[7.62,100.08]] },
  { name: 'สงขลา', points: [[7.19,100.59],[7.01,100.47]] },
  { name: 'สตูล', points: [[6.62,100.07]] },
  { name: 'ปัตตานี', points: [[6.87,101.25]] },
  { name: 'ยะลา', points: [[6.54,101.28]] },
  { name: 'นราธิวาส', points: [[6.43,101.82]] },
];

function detectBrand(name) {
  const n = name.toLowerCase();
  if (n.includes('ปตท') || n.includes('ptt')) return 'PTT';
  if (n.includes('pt ') || n.includes('พีที') || n.match(/^pt\b/) || n.includes('pt gas')) return 'PT';
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

function isRealStation(name, types) {
  const n = name.toLowerCase();

  // ชั้น 1: whitelist — ถ้ามีชื่อแบรนด์ปั๊ม ผ่านเสมอ
  for (const w of WHITELIST) {
    if (n.includes(w)) return true;
  }

  // ชั้น 2: blacklist — ไม่ใช่ปั๊มแน่ๆ (เฉพาะที่ไม่มีแบรนด์)
  for (const b of BLACKLIST) {
    if (n.includes(b)) return false;
  }

  // ชั้น 3: Google types — ต้องมี gas_station
  if (types && !types.includes('gas_station')) return false;

  // ชั้น 4: รับไว้ก่อน ถ้าผ่านทุกชั้น
  return true;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function searchPlaces(lat, lng, pageToken = null) {
  const url = pageToken
    ? `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${pageToken}&key=${API_KEY}`
    : `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=30000&type=gas_station&language=th&key=${API_KEY}`;
  const res = await fetch(url);
  return res.json();
}

async function getPlaceDetails(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number&language=th&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.result || null;
}

// สร้าง grid ครอบทั้งประเทศไทย ทุก 0.2 องศา (~22 กม.)
function generateGrid() {
  const points = [];
  // ประเทศไทย: lat 5.6-20.5, lng 97.3-105.7
  for (let lat = 5.6; lat <= 20.5; lat += 0.2) {
    for (let lng = 97.3; lng <= 105.7; lng += 0.2) {
      points.push([parseFloat(lat.toFixed(1)), parseFloat(lng.toFixed(1))]);
    }
  }
  return points;
}

async function findProvinceId(lat, lng) {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=th&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.results?.[0]) {
      const comp = data.results[0].address_components;
      const prov = comp?.find(c => c.types.includes('administrative_area_level_1'));
      if (prov) {
        let name = prov.long_name.replace('จังหวัด', '').trim();
        if (name.includes('กรุงเทพ')) name = 'กรุงเทพมหานคร';
        const p = await prisma.provinces.findFirst({ where: { name: { contains: name } } });
        if (p) return p.id;
      }
    }
  } catch {}
  return null;
}

async function main() {
  console.log('🚀 Import ปั๊มทั่วประเทศ (Grid 22km + กรอง 4 ชั้น + Place Details)\n');

  // สร้างจังหวัดทั้งหมด
  for (const prov of PROVINCES) {
    await prisma.provinces.upsert({ where: { name: prov.name }, update: {}, create: { name: prov.name } });
  }

  const existing = await prisma.stations.findMany({ select: { lat: true, lng: true } });
  const existingSet = new Set(existing.map(s => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`));
  console.log(`📊 ปั๊มปัจจุบัน: ${existing.length}`);

  const grid = generateGrid();
  console.log(`📐 Grid points: ${grid.length}\n`);

  let totalAdded = 0, totalSkipped = 0, totalFiltered = 0;
  const provinceCache = {}; // cache province_id by area

  for (let gi = 0; gi < grid.length; gi++) {
    const [lat, lng] = grid[gi];
    const progress = `[${gi+1}/${grid.length}]`;

    let pageToken = null, pageNum = 0;
    let foundAny = false;

    do {
      const data = await searchPlaces(lat, lng, pageToken);

      if (data.status !== 'OK') break;

      const results = data.results || [];
      if (results.length > 0 && !foundAny) {
        foundAny = true;
        console.log(`${progress} (${lat}, ${lng}) — ${results.length}+ ปั๊ม`);
      }

      for (const place of results) {
        const plat = place.geometry.location.lat;
        const plng = place.geometry.location.lng;
        const key = `${plat.toFixed(4)},${plng.toFixed(4)}`;

        if (existingSet.has(key)) { totalSkipped++; continue; }

        // กรอง 4 ชั้น
        if (!isRealStation(place.name, place.types)) {
          totalFiltered++;
          continue;
        }

        // ดึง Place Details (ชื่อไทย + ที่อยู่ + เบอร์โทร)
        let name = place.name;
        let address = place.vicinity || '';
        let phone = null;

        try {
          const details = await getPlaceDetails(place.place_id);
          if (details) {
            name = details.name || name;
            address = details.formatted_address || address;
            phone = details.formatted_phone_number || null;
          }
        } catch {}

        // กรองชื่อไทยอีกรอบ
        if (!isRealStation(name, place.types)) {
          totalFiltered++;
          continue;
        }

        // หาจังหวัด (cache by grid area)
        const areaKey = `${Math.round(plat*5)},${Math.round(plng*5)}`;
        if (!provinceCache[areaKey]) {
          provinceCache[areaKey] = await findProvinceId(plat, plng);
        }
        const provinceId = provinceCache[areaKey] || 1;

        try {
          const station = await prisma.stations.create({
            data: { name, brand: detectBrand(name), address, province_id: provinceId, lat: plat, lng: plng, phone },
          });

          await prisma.fuel_status.createMany({
            data: FUEL_TYPES.map(ft => ({
              station_id: station.id, fuel_type: ft,
              is_available: Math.random() < 0.7,
              remaining_cars: Math.random() < 0.7 ? Math.floor(Math.random() * 200) + 10 : null,
              updated_by: 'import',
            })),
          });

          existingSet.add(key);
          totalAdded++;
          console.log(`   ✅ ${name} (${detectBrand(name)})`);
        } catch (e) {}
      }

      pageToken = data.next_page_token || null;
      pageNum++;
      if (pageToken) await sleep(2500);

    } while (pageToken && pageNum < 3);

    // สรุปทุก 50 grid points
    if ((gi+1) % 50 === 0) {
      console.log(`\n--- ${progress} เพิ่ม: ${totalAdded} | ซ้ำ: ${totalSkipped} | กรอง: ${totalFiltered} ---\n`);
    }
  }

  console.log(`\n🏁 เสร็จสิ้น!`);
  console.log(`   เพิ่มใหม่: ${totalAdded}`);
  console.log(`   ซ้ำ (ข้าม): ${totalSkipped}`);
  console.log(`   กรองออก: ${totalFiltered}`);
  console.log(`   Grid points: ${grid.length}`);
  console.log(`   รวมในระบบ: ${existing.length + totalAdded}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
