require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME || 'Admin';

    if (!email || !password) {
        console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.');
        console.error('Set them in your .env file or pass them directly:');
        console.error('  ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=strongpassword node seed_user.js');
        process.exit(1);
    }

    if (password.length < 8) {
        console.error('Error: ADMIN_PASSWORD must be at least 8 characters.');
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
                role: 'ADMIN'
            }
        });
        console.log(`Created admin user: ${email}`);
    } else {
        console.log(`User ${email} already exists.`);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
