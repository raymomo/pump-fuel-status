const bcrypt = require('bcryptjs');
const prisma = require('../prismaClient');

async function main() {
  console.log('🔐 Hashing plain text passwords...\n');

  // Hash staff passwords
  const staffList = await prisma.staff.findMany();
  let staffHashed = 0;
  for (const s of staffList) {
    if (!s.password.startsWith('$2a$') && !s.password.startsWith('$2b$')) {
      await prisma.staff.update({
        where: { id: s.id },
        data: { password: bcrypt.hashSync(s.password, 10) },
      });
      staffHashed++;
      console.log(`  ✅ Staff: ${s.username}`);
    }
  }

  // Hash admin passwords
  const adminList = await prisma.admins.findMany();
  let adminHashed = 0;
  for (const a of adminList) {
    if (!a.password.startsWith('$2a$') && !a.password.startsWith('$2b$')) {
      await prisma.admins.update({
        where: { id: a.id },
        data: { password: bcrypt.hashSync(a.password, 10) },
      });
      adminHashed++;
      console.log(`  ✅ Admin: ${a.username}`);
    }
  }

  console.log(`\n========================================`);
  console.log(`Staff hashed: ${staffHashed}/${staffList.length}`);
  console.log(`Admin hashed: ${adminHashed}/${adminList.length}`);
  console.log(`========================================`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
