const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.service.createMany({
    data: [
      { name: 'Wash & Fold', description: 'Everyday laundry, washed and neatly folded.', unitType: 'KG', pricePerUnit: 3.5, estimatedMinutes: 120 },
      { name: 'Dry Cleaning', description: 'Professional dry cleaning for delicate fabrics.', unitType: 'PIECE', pricePerUnit: 12.0, estimatedMinutes: 240 },
      { name: 'Ironing Only', description: 'Steam ironing for a crisp look.', unitType: 'PIECE', pricePerUnit: 2.5, estimatedMinutes: 60 }
    ]
  });

  const user = await prisma.user.create({
    data: {
      fullName: 'John Doe',
      email: 'john@example.com',
      passwordHash: 'hashedpassword',
      phone: '1234567890',
      role: 'CUSTOMER'
    }
  });

  await prisma.order.create({
    data: {
      customerId: user.id,
      pickupAddress: '123 Main St',
      deliveryAddress: '123 Main St',
      status: 'PENDING',
      totalQuantity: 5,
      subtotal: 17.5,
      finalAmount: 17.5,
      paymentMethod: 'CASH',
      scheduledPickupTime: new Date()
    }
  });

  console.log('Database seeded successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
