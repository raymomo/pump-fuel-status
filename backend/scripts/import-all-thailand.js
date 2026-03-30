const prisma = require('../prismaClient');

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) { console.error('GOOGLE_API_KEY env var required'); process.exit(1); }
const FUEL_TYPES = ['ดีเซล', 'ดีเซล B7', 'แก๊สโซฮอล์ 91', 'แก๊สโซฮอล์ 95', 'แก๊สโซฮอล์ E20', 'เบนซิน 95'];

// ทุกจังหวัด + จุดค้นหาหลายจุดสำหรับจังหวัดใหญ่
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
  if (n.includes('pt ') || n.includes('พีที') || n.match(/^pt\b/)) return 'PT';
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
  return res.json();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('🚀 เริ่มดึงข้อมูลปั๊มทั่วประเทศไทย 77 จังหวัด...\n');

  // Load existing stations for dedup
  const existing = await prisma.stations.findMany({ select: { lat: true, lng: true } });
  const existingSet = new Set(existing.map(s => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`));
  console.log(`📊 ปั๊มในระบบปัจจุบัน: ${existing.length}\n`);

  // Ensure all provinces exist
  for (const prov of PROVINCES) {
    await prisma.provinces.upsert({ where: { name: prov.name }, update: {}, create: { name: prov.name } });
  }

  let totalAdded = 0, totalSkipped = 0, totalErrors = 0;

  for (const prov of PROVINCES) {
    const dbProv = await prisma.provinces.findFirst({ where: { name: prov.name } });
    if (!dbProv) continue;

    for (const [lat, lng] of prov.points) {
      console.log(`📍 ${prov.name} (${lat}, ${lng})`);

      let pageToken = null, pageNum = 0;

      do {
        const data = await searchPlaces(lat, lng, pageToken);

        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
          console.log(`   ⚠️ ${data.status}: ${data.error_message || ''}`);
          break;
        }

        const results = data.results || [];
        console.log(`   หน้า ${pageNum + 1}: ${results.length} ปั๊ม`);

        for (const place of results) {
          const plat = place.geometry.location.lat;
          const plng = place.geometry.location.lng;
          const key = `${plat.toFixed(4)},${plng.toFixed(4)}`;

          if (existingSet.has(key)) { totalSkipped++; continue; }

          try {
            const station = await prisma.stations.create({
              data: {
                name: place.name,
                brand: detectBrand(place.name),
                address: place.vicinity || '',
                province_id: dbProv.id,
                lat: plat,
                lng: plng,
              },
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
            console.log(`   ✅ ${place.name} (${detectBrand(place.name)})`);
          } catch (e) {
            totalErrors++;
          }
        }

        pageToken = data.next_page_token || null;
        pageNum++;
        if (pageToken) await sleep(2500);

      } while (pageToken && pageNum < 3);
    }
    console.log('');
  }

  console.log(`\n🏁 เสร็จสิ้น!`);
  console.log(`   เพิ่มใหม่: ${totalAdded}`);
  console.log(`   ซ้ำ (ข้าม): ${totalSkipped}`);
  console.log(`   ข้อผิดพลาด: ${totalErrors}`);
  console.log(`   รวมในระบบ: ${existing.length + totalAdded}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
