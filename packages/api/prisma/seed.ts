// packages/api/prisma/seed.ts
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const departments = [
    { name: 'Human Resources', code: 'HR', order: 1 },
    { name: 'Finance', code: 'FIN', order: 2 },
    { name: 'IT & Technology', code: 'IT', order: 3 },
    { name: 'Legal', code: 'LEGAL', order: 4 },
    { name: 'Operations', code: 'OPS', order: 5 },
    { name: 'Marketing', code: 'MKT', order: 6 },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    });
  }
  console.log('✅ Departments created');

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@company.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      name: process.env.SEED_ADMIN_NAME || 'System Admin',
      role: Role.SUPER_ADMIN,
    },
  });
  console.log(`✅ Admin user created: ${adminEmail}`);

  console.log('🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
