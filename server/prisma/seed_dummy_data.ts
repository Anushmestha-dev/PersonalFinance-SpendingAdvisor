import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedUserDummyData(user: { id: string; name: string | null; email: string }) {
  console.log(`Seeding authentic Indian finance dummy data for user: ${user.name || user.email} (${user.id})`);

  // 1. Fetch categories
  const categories = await prisma.category.findMany();
  const catMap = new Map<string, string>();
  categories.forEach(c => catMap.set(c.name, c.id));

  const getCatId = (name: string, fallbackType: string = 'EXPENSE') => {
    let id = catMap.get(name);
    if (!id) {
      // Find any category of that type
      const found = categories.find(c => c.type === fallbackType);
      id = found ? found.id : categories[0]?.id;
    }
    return id;
  };

  // 2. Remove existing user accounts, budgets, goals, transactions to avoid duplicate clutter
  // Transactions cascade when accounts are deleted, but let's be clean
  await prisma.budget.deleteMany({ where: { userId: user.id } });
  await prisma.goal.deleteMany({ where: { userId: user.id } });
  await prisma.account.deleteMany({ where: { userId: user.id } });

  // 3. Create Accounts
  const hdfc = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'HDFC Bank - Salary A/c',
      type: 'DEPOSITORY',
      balance: 54200.00,
      currency: 'INR',
    }
  });

  const sbi = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'SBI - Savings A/c',
      type: 'DEPOSITORY',
      balance: 92500.00,
      currency: 'INR',
    }
  });

  const iciciCredit = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'ICICI Amazon Pay Credit Card',
      type: 'CREDIT',
      balance: 0.00,
      currency: 'INR',
    }
  });

  const zerodha = await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Zerodha Mutual Funds & Stocks',
      type: 'INVESTMENT',
      balance: 185000.00,
      currency: 'INR',
    }
  });

  console.log(`Created 4 accounts for ${user.name}`);

  // 4. Create Budgets for Current Month (October 2026)
  const currentMonth = 10;
  const currentYear = 2026;

  const budgetDefs = [
    { cat: 'Food', amount: 16000 },
    { cat: 'Rent', amount: 24000 },
    { cat: 'Transport', amount: 6000 },
    { cat: 'Utilities', amount: 5000 },
    { cat: 'Shopping', amount: 12000 },
    { cat: 'Entertainment', amount: 4500 },
    { cat: 'Healthcare', amount: 3500 },
  ];

  for (const b of budgetDefs) {
    const categoryId = catMap.get(b.cat);
    if (categoryId) {
      await prisma.budget.create({
        data: {
          userId: user.id,
          categoryId,
          amount: b.amount,
          month: currentMonth,
          year: currentYear,
        }
      });
    }
  }

  console.log(`Created monthly budgets for ${user.name}`);

  // 5. Create Realistic Savings Goals
  const goalDefs = [
    {
      name: 'Emergency Fund (6 Months)',
      targetAmount: 300000,
      savedAmount: 195000,
      deadline: new Date('2027-03-31T00:00:00Z'),
    },
    {
      name: 'New MacBook Pro / Workstation',
      targetAmount: 140000,
      savedAmount: 105000,
      deadline: new Date('2026-12-15T00:00:00Z'),
    },
    {
      name: 'Diwali Trip & Family Vacation',
      targetAmount: 50000,
      savedAmount: 38000,
      deadline: new Date('2026-11-10T00:00:00Z'),
    },
    {
      name: 'Car Down Payment',
      targetAmount: 250000,
      savedAmount: 120000,
      deadline: new Date('2027-06-30T00:00:00Z'),
    },
  ];

  for (const g of goalDefs) {
    await prisma.goal.create({
      data: {
        userId: user.id,
        name: g.name,
        targetAmount: g.targetAmount,
        savedAmount: g.savedAmount,
        deadline: g.deadline,
      }
    });
  }

  console.log(`Created savings goals for ${user.name}`);

  // 6. Generate Authentic Historical Transactions (May 2026 - October 2026)
  const salaryCat = getCatId('Salary', 'INCOME');
  const freelanceCat = getCatId('Freelance', 'INCOME');
  const foodCat = getCatId('Food');
  const transportCat = getCatId('Transport');
  const rentCat = getCatId('Rent');
  const utilsCat = getCatId('Utilities');
  const entCat = getCatId('Entertainment');
  const shopCat = getCatId('Shopping');
  const healthCat = getCatId('Healthcare');

  const transactionsToCreate: Array<{
    accountId: string;
    categoryId: string;
    amount: number;
    date: Date;
    description: string;
    type: 'INCOME' | 'EXPENSE';
  }> = [];

  // Monthly patterns for past 6 months (May, Jun, Jul, Aug, Sep, Oct 2026)
  const months = [
    { year: 2026, month: 4, label: 'May 2026' },
    { year: 2026, month: 5, label: 'Jun 2026' },
    { year: 2026, month: 6, label: 'Jul 2026' },
    { year: 2026, month: 7, label: 'Aug 2026' },
    { year: 2026, month: 8, label: 'Sep 2026' },
    { year: 2026, month: 9, label: 'Oct 2026' }, // Note: JS Date month 9 = October
  ];

  for (const m of months) {
    const isCurrent = m.month === 9;

    // Monthly Salary
    transactionsToCreate.push({
      accountId: hdfc.id,
      categoryId: salaryCat,
      amount: 85000,
      date: new Date(m.year, m.month, 1, 10, 30),
      description: 'Monthly Salary Credit - Tech Corp India',
      type: 'INCOME',
    });

    // Rent
    transactionsToCreate.push({
      accountId: hdfc.id,
      categoryId: rentCat,
      amount: 24000,
      date: new Date(m.year, m.month, 5, 11, 0),
      description: 'Apartment Monthly Rent Transfer',
      type: 'EXPENSE',
    });

    // Electricity / Utility
    transactionsToCreate.push({
      accountId: hdfc.id,
      categoryId: utilsCat,
      amount: 2450 + (m.month % 3) * 350,
      date: new Date(m.year, m.month, 8, 14, 20),
      description: 'Electricity Bill - BESCOM Online',
      type: 'EXPENSE',
    });

    // WiFi Bill
    transactionsToCreate.push({
      accountId: iciciCredit.id,
      categoryId: utilsCat,
      amount: 1179,
      date: new Date(m.year, m.month, 10, 9, 15),
      description: 'Airtel Xstream Fiber Broadband',
      type: 'EXPENSE',
    });

    // Grocery Runs
    transactionsToCreate.push({
      accountId: hdfc.id,
      categoryId: foodCat,
      amount: 3820 + (m.month % 2) * 450,
      date: new Date(m.year, m.month, 6, 17, 45),
      description: 'D-Mart Supermarket - Monthly Groceries',
      type: 'EXPENSE',
    });

    transactionsToCreate.push({
      accountId: iciciCredit.id,
      categoryId: foodCat,
      amount: 780 + (m.month * 110) % 400,
      date: new Date(m.year, m.month, 12, 20, 10),
      description: 'Swiggy Dinner Order',
      type: 'EXPENSE',
    });

    // Fuel / Transport
    transactionsToCreate.push({
      accountId: iciciCredit.id,
      categoryId: transportCat,
      amount: 2200,
      date: new Date(m.year, m.month, 7, 18, 30),
      description: 'Petrol - Indian Oil Fuel Station',
      type: 'EXPENSE',
    });

    transactionsToCreate.push({
      accountId: hdfc.id,
      categoryId: transportCat,
      amount: 450 + (m.month % 4) * 80,
      date: new Date(m.year, m.month, 11, 8, 45),
      description: 'Uber Auto & Cab Rides',
      type: 'EXPENSE',
    });

    // Entertainment
    transactionsToCreate.push({
      accountId: iciciCredit.id,
      categoryId: entCat,
      amount: 649,
      date: new Date(m.year, m.month, 15, 12, 0),
      description: 'Netflix Standard Subscription',
      type: 'EXPENSE',
    });

    // Shopping
    transactionsToCreate.push({
      accountId: iciciCredit.id,
      categoryId: shopCat,
      amount: 2499 + (m.month % 3) * 1200,
      date: new Date(m.year, m.month, 18, 16, 20),
      description: 'Amazon India Online Shopping',
      type: 'EXPENSE',
    });

    // Healthcare
    transactionsToCreate.push({
      accountId: hdfc.id,
      categoryId: healthCat,
      amount: 850 + (m.month % 2) * 350,
      date: new Date(m.year, m.month, 22, 19, 0),
      description: 'Apollo Pharmacy & Health Supplies',
      type: 'EXPENSE',
    });

    // Occasional Freelance Income (July and September)
    if (m.month === 6) {
      transactionsToCreate.push({
        accountId: sbi.id,
        categoryId: freelanceCat,
        amount: 22000,
        date: new Date(m.year, m.month, 20, 15, 0),
        description: 'Freelance UI/UX Web Development Client Payout',
        type: 'INCOME',
      });
    }
    if (m.month === 8) {
      transactionsToCreate.push({
        accountId: sbi.id,
        categoryId: freelanceCat,
        amount: 18000,
        date: new Date(m.year, m.month, 25, 14, 30),
        description: 'Mobile App Consulting Project Retainer',
        type: 'INCOME',
      });
    }

    // Additional October (current month) transactions up to today (October 12)
    if (isCurrent) {
      transactionsToCreate.push({
        accountId: iciciCredit.id,
        categoryId: foodCat,
        amount: 1450,
        date: new Date(2026, 9, 3, 21, 15),
        description: 'Zomato Weekend Dinner with Friends',
        type: 'EXPENSE',
      });

      transactionsToCreate.push({
        accountId: hdfc.id,
        categoryId: entCat,
        amount: 1200,
        date: new Date(2026, 9, 4, 18, 0),
        description: 'BookMyShow - PVR IMAX Movie Tickets',
        type: 'EXPENSE',
      });

      transactionsToCreate.push({
        accountId: iciciCredit.id,
        categoryId: shopCat,
        amount: 4899,
        date: new Date(2026, 9, 9, 13, 40),
        description: 'Myntra Diwali Festive Clothing Sale',
        type: 'EXPENSE',
      });

      transactionsToCreate.push({
        accountId: hdfc.id,
        categoryId: foodCat,
        amount: 1240,
        date: new Date(2026, 9, 11, 11, 20),
        description: 'Blinkit Quick Grocery Delivery',
        type: 'EXPENSE',
      });

      transactionsToCreate.push({
        accountId: sbi.id,
        categoryId: foodCat,
        amount: 620,
        date: new Date(2026, 9, 12, 9, 30),
        description: 'Blue Tokai Coffee & Breakfast Cafe',
        type: 'EXPENSE',
      });
    }
  }

  // Insert all transactions
  for (const t of transactionsToCreate) {
    await prisma.transaction.create({
      data: {
        accountId: t.accountId,
        categoryId: t.categoryId,
        amount: t.amount,
        date: t.date,
        description: t.description,
        type: t.type,
      }
    });
  }

  console.log(`Successfully created ${transactionsToCreate.length} authentic transactions for ${user.name}`);
}

async function main() {
  const users = await prisma.user.findMany();
  console.log(`Found ${users.length} users to populate.`);
  for (const user of users) {
    await seedUserDummyData(user);
  }
  console.log('Dummy data generation completed successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error seeding dummy data:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
