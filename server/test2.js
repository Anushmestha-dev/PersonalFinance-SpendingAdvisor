// Using native fetch

async function runTests() {
  const baseUrl = 'http://localhost:3000/api';
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    const resA = await fetch(`${baseUrl}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `a${Date.now()}@example.com`, name: 'A', password: 'pass' }) });
    const cookieA = resA.headers.get('set-cookie');
    
    const resB = await fetch(`${baseUrl}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `b${Date.now()}@example.com`, name: 'B', password: 'pass' }) });
    const cookieB = resB.headers.get('set-cookie');
    
    const headersA = { 'Content-Type': 'application/json', 'Cookie': cookieA };
    const headersB = { 'Content-Type': 'application/json', 'Cookie': cookieB };

    // Get categories to use
    const catsRes = await fetch(`${baseUrl}/categories`, { headers: headersA });
    const categories = await catsRes.json();
    const foodCat = categories.find(c => c.name === 'Food');

    // User A creates Account and Transaction
    const accRes = await fetch(`${baseUrl}/accounts`, { method: 'POST', headers: headersA, body: JSON.stringify({ name: 'Checking', type: 'DEPOSITORY', balance: 1000 }) });
    const accountA = await accRes.json();

    await fetch(`${baseUrl}/transactions`, { method: 'POST', headers: headersA, body: JSON.stringify({ accountId: accountA.id, categoryId: foodCat.id, amount: 200, date: new Date().toISOString(), type: 'EXPENSE' }) });

    // User A creates Budget
    const budgetRes = await fetch(`${baseUrl}/budgets`, { method: 'POST', headers: headersA, body: JSON.stringify({ categoryId: foodCat.id, amount: 500, month: new Date().getMonth() + 1, year: new Date().getFullYear() }) });
    const budgetA = await budgetRes.json();
    assert(budgetRes.status === 201, 'User A created budget');

    // User A creates Goal
    const goalRes = await fetch(`${baseUrl}/goals`, { method: 'POST', headers: headersA, body: JSON.stringify({ name: 'Vacation', targetAmount: 2000, deadline: new Date(Date.now() + 8640000000).toISOString() }) });
    const goalA = await goalRes.json();
    assert(goalRes.status === 201, 'User A created goal');

    // User B tries to touch A's budget
    const bDelBudget = await fetch(`${baseUrl}/budgets/${budgetA.id}`, { method: 'DELETE', headers: headersB });
    assert(bDelBudget.status === 404, 'User B gets 404 deleting User A budget');

    // User B tries to touch A's goal
    const bEditGoal = await fetch(`${baseUrl}/goals/${goalA.id}`, { method: 'PUT', headers: headersB, body: JSON.stringify({ name: 'Hacked', targetAmount: 10, deadline: new Date().toISOString() }) });
    assert(bEditGoal.status === 404, 'User B gets 404 editing User A goal');

    // Summary Test
    const sumA = await fetch(`${baseUrl}/budgets/summary`, { headers: headersA }).then(r => r.json());
    assert(sumA.summary[0].spent === 200, 'User A summary correctly includes their spending');

    const sumB = await fetch(`${baseUrl}/budgets/summary`, { headers: headersB }).then(r => r.json());
    assert(sumB.summary.length === 0, 'User B summary is completely isolated (empty)');

  } catch (e) {
    console.error("Crash:", e);
  }
  console.log(`\nSummary: ${passed} Passed, ${failed} Failed`);
}
runTests();
