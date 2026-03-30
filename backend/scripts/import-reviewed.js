const prisma = require('../prismaClient');
const data = require('./mukdahan-nakhonphanom-clean.json');

const FUEL_TYPES = ['ดีเซล', 'ดีเซล B7', 'แก๊สโซฮอล์ 91', 'แก๊สโซฮอล์ 95', 'แก๊สโซฮอล์ E20', 'เบนซิน 95'];

function detectBrand(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('ปตท') || n.includes('ptt') || n.includes('ป.ต.ท')) return 'PTT';
  if (n.match(/\bpt\b/) || n.includes('พีที') || n.includes('pt ')) return 'PT';
  if (n.includes('บางจาก') || n.includes('bangchak')) return 'Bangchak';
  if (n.includes('เชลล์') || n.includes('shell')) return 'Shell';
  if (n.includes('เอสโซ่') || n.includes('esso')) return 'Esso';
  if (n.includes('คาลเท็กซ์') || n.includes('caltex')) return 'Caltex';
  if (n.includes('ซัสโก้') || n.includes('susco')) return 'Susco';
  if (n.includes('irpc') || n.includes('ไออาร์พีซี')) return 'IRPC';
  if (n.includes('เพียว') || n.includes('pure')) return 'Pure';
  if (n.includes('คอสโม') || n.includes('cosmo')) return 'Cosmo';
  if (n.includes('คราวน์') || n.includes('crown')) return 'Crown';
  if (n.includes('ทีพีไอ') || n.includes('tpi')) return 'TPI';
  return 'Other';
}

function getProvince(address) {
  const addr = (address || '').toLowerCase();
  if (addr.includes('มุกดาหาร')) return 'มุกดาหาร';
  if (addr.includes('นครพนม')) return 'นครพนม';
  if (addr.includes('สกลนคร')) return 'สกลนคร';
  if (addr.includes('ยโสธร')) return 'ยโสธร';
  if (addr.includes('ร้อยเอ็ด')) return 'ร้อยเอ็ด';
  if (addr.includes('กาฬสินธุ์')) return 'กาฬสินธุ์';
  if (addr.includes('อำนาจเจริญ')) return 'อำนาจเจริญ';
  if (addr.includes('บึงกาฬ')) return 'บึงกาฬ';
  return null;
}

async function main() {
  console.log('🚀 Import ปั๊มที่ผ่านการคัดแล้ว:', data.length, 'ปั๊ม\n');

  const existingSet = new Set();
  const existing = await prisma.stations.findMany({ select: { lat: true, lng: true } });
  existing.forEach(s => existingSet.add(`${s.lat.toFixed(4)},${s.lng.toFixed(4)}`));

  // เตรียม provinces
  const provCache = {};
  async function getProvinceId(name) {
    if (!name) return 1;
    if (provCache[name]) return provCache[name];
    let p = await prisma.provinces.findFirst({ where: { name: { contains: name } } });
    if (!p) p = await prisma.provinces.create({ data: { name } });
    provCache[name] = p.id;
    return p.id;
  }

  let added = 0, skipped = 0;

  for (const s of data) {
    const key = `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`;
    if (existingSet.has(key)) { skipped++; continue; }

    const provName = getProvince(s.address);
    const provinceId = await getProvinceId(provName);
    const brand = detectBrand(s.name);

    try {
      const station = await prisma.stations.create({
        data: {
          name: s.name,
          brand,
          address: s.address || '',
          province_id: provinceId,
          lat: s.lat,
          lng: s.lng,
          phone: s.phone || null,
        },
      });

      await prisma.fuel_status.createMany({
        data: FUEL_TYPES.map(ft => ({
          station_id: station.id,
          fuel_type: ft,
          is_available: Math.random() < 0.7,
          remaining_cars: Math.random() < 0.7 ? Math.floor(Math.random() * 200) + 10 : null,
          updated_by: 'reviewed_import',
        })),
      });

      existingSet.add(key);
      added++;
      if (added % 50 === 0) console.log(`[${added}] ${s.name} (${brand}) — ${provName}`);
    } catch {}
  }

  console.log('\n🏁 เสร็จสิ้น!');
  console.log('   เพิ่มใหม่:', added);
  console.log('   ซ้ำ (ข้าม):', skipped);
  console.log('   รวมในระบบ:', await prisma.stations.count());
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
