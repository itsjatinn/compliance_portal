const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  console.log(Object.keys(p).sort());
  await p.$disconnect();
}

main();
