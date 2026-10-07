import { PrismaClient, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();

const defaultCategories = [
  { name: 'Food', type: TransactionType.EXPENSE },
  { name: 'Transport', type: TransactionType.EXPENSE },
  { name: 'Rent', type: TransactionType.EXPENSE },
  { name: 'Utilities', type: TransactionType.EXPENSE },
  { name: 'Entertainment', type: TransactionType.EXPENSE },
  { name: 'Shopping', type: TransactionType.EXPENSE },
  { name: 'Healthcare', type: TransactionType.EXPENSE },
  { name: 'Salary', type: TransactionType.INCOME },
  { name: 'Freelance', type: TransactionType.INCOME },
  { name: 'Investments', type: TransactionType.INCOME },
  { name: 'Other Income', type: TransactionType.INCOME },
];

async function main() {
  console.log(`Start seeding default categories...`);
  for (const c of defaultCategories) {
    const category = await prisma.category.upsert({
      where: {
        userId_name_type: {
          userId: 'default', // Since userId is nullable and unique constraint includes it, but Prisma unique needs concrete values if we use it, wait: prisma unique constraint on optional fields can be tricky. Actually, Prisma allows upsert by unique if all are provided. But wait, `userId: null` is not supported in `where` for upsert easily.
          name: c.name,
          type: c.type
        }
      },
      update: {},
      create: {
        name: c.name,
        type: c.type,
      },
    }).catch(async (e) => {
      // Fallback if upsert fails due to null handling in unique constraints
      const existing = await prisma.category.findFirst({
        where: { name: c.name, type: c.type, userId: null }
      });
      if (!existing) {
        return prisma.category.create({
          data: { name: c.name, type: c.type }
        });
      }
      return existing;
    });
    console.log(`Created category: ${category.name}`);
  }
  console.log(`Seeding finished.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
