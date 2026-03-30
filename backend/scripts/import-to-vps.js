const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const data = JSON.parse(require('fs').readFileSync('/app/export-stations.json', 'utf8'));

(async () => {
  await prisma.fuel_status.deleteMany({});
  await prisma.staff_station_requests.deleteMany({});
  await prisma.station_requests.deleteMany({});
  await prisma.staff.updateMany({ data: { station_id: null } });
  await prisma.stations.deleteMany({});
  console.log('Cleared old data');

  let added = 0;
  for (const s of data) {
    try {
      const station = await prisma.stations.create({
        data: { name: s.name, brand: s.brand, address: s.address, province_id: s.province_id, lat: s.lat, lng: s.lng, phone: s.phone }
      });
      if (s.fuel_status && s.fuel_status.length > 0) {
        await prisma.fuel_status.createMany({
          data: s.fuel_status.map(f => ({
            station_id: station.id, fuel_type: f.fuel_type, is_available: f.is_available,
            updated_by: f.updated_by, remaining_cars: f.remaining_cars
          }))
        });
      }
      added++;
    } catch (e) { console.log('Skip:', s.name, e.message.slice(0, 80)); }
  }
  console.log('Imported', added, 'stations');
  await prisma.$disconnect();
})();
