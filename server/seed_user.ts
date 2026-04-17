import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from './lib/prisma';
import { checkPasswordPolicy } from './lib/passwordPolicy';

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? 'Admin';

  if (!email || !password) {
    console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.');
    console.error('Set them in your .env file or pass them directly:');
    console.error('  ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=strongpassword tsx seed_user.ts');
    process.exit(1);
  }

  const policy = checkPasswordPolicy(password);
  if (!policy.ok) {
    console.error('Error: ADMIN_PASSWORD does not meet the password policy:');
    for (const reason of policy.reasons) {
      console.error(`  - ${reason}`);
    }
    process.exit(1);
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (!existingUser) {
    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'ADMIN',
      },
    });
    console.log(`Created admin user: ${email}`);
  } else {
    console.log(`User ${email} already exists.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
