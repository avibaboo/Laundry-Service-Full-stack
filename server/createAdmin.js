const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  const email = 'admin@freshwave.com';
  const password = 'admin';

  try {
    const existingAdmin = await prisma.user.findUnique({ where: { email } });
    
    if (existingAdmin) {
      console.log('Admin already exists!');
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await prisma.user.create({
      data: {
        fullName: 'Admin User',
        email,
        phone: '0000000000',
        passwordHash,
        role: 'ADMIN'
      }
    });

    console.log('Admin user created successfully!');
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
