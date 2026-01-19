const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    const email = 'admin@propsecure.com';
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (!existingUser) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: 'Admin User'
            }
        });
        console.log(`Created user: ${email} / admin123`);
    } else {
        console.log(`User ${email} already exists.`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
