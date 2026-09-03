const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findFirst().then(u => {
  console.log(JSON.stringify(u));
  p.$disconnect();
});
