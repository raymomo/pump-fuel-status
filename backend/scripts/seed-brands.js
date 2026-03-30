const prisma = require('../prismaClient');

const brands = [
  { name: 'PTT', color: '#e65100', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/PTT_logo.svg/200px-PTT_logo.svg.png', sort_order: 1 },
  { name: 'PT', color: '#ad1457', logo_url: 'https://upload.wikimedia.org/wikipedia/th/thumb/8/86/Pt_logo.png/200px-Pt_logo.png', sort_order: 2 },
  { name: 'Bangchak', color: '#2e7d32', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Bangchak_Corporation_logo.svg/200px-Bangchak_Corporation_logo.svg.png', sort_order: 3 },
  { name: 'Shell', color: '#f57f17', logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e8/Shell_logo.svg/200px-Shell_logo.svg.png', sort_order: 4 },
  { name: 'Esso', color: '#bf360c', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Esso-Logo.svg/200px-Esso-Logo.svg.png', sort_order: 5 },
  { name: 'Caltex', color: '#1565c0', logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/fa/Caltex_logo.svg/200px-Caltex_logo.svg.png', sort_order: 6 },
  { name: 'Susco', color: '#283593', logo_url: null, sort_order: 7 },
  { name: 'IRPC', color: '#00695c', logo_url: null, sort_order: 8 },
  { name: 'Pure', color: '#6a1b9a', logo_url: null, sort_order: 9 },
  { name: 'FPT', color: '#0d47a1', logo_url: null, sort_order: 10 },
  { name: 'Thaioil', color: '#1a237e', logo_url: null, sort_order: 11 },
];

async function main() {
  for (const b of brands) {
    await prisma.brands.upsert({
      where: { name: b.name },
      update: { color: b.color, logo_url: b.logo_url, sort_order: b.sort_order },
      create: b,
    });
    console.log(`✅ ${b.name}`);
  }
  console.log(`\nDone! ${brands.length} brands seeded.`);
}

main().then(() => process.exit(0));
