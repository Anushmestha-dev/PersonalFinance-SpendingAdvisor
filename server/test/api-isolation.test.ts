export async function runApiIsolationTests(baseUrl: string = 'http://localhost:3000/api'): Promise<{ passed: number; failed: number }> {
  console.log('\n========================================');
  console.log('🔒 RUNNING AUTH & USER ISOLATION TESTS');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${details ? ` -> ${details}` : ''}`);
      failed++;
    }
  }

  // Helper to extract cookie from set-cookie header
  const getCookie = (res: Response) => {
    const raw = res.headers.get('set-cookie');
    if (!raw) return '';
    return raw.split(';')[0];
  };

  try {
    // ----------------------------------------------------
    // Part 1: Unauthenticated Requests (Must Return 401)
    // ----------------------------------------------------
    console.log('--- 1. Unauthenticated 401 Enforcement ---');

    const protectedEndpoints = [
      { method: 'GET', path: '/accounts', name: 'GET /api/accounts' },
      { method: 'GET', path: '/transactions', name: 'GET /api/transactions' },
      { method: 'GET', path: '/budgets/summary', name: 'GET /api/budgets/summary' },
      { method: 'GET', path: '/goals', name: 'GET /api/goals' },
      { method: 'GET', path: '/alerts', name: 'GET /api/alerts' },
      { method: 'GET', path: '/forecast', name: 'GET /api/forecast' },
      { method: 'GET', path: '/ai/insights', name: 'GET /api/ai/insights' },
      { method: 'POST', path: '/ai/chat', name: 'POST /api/ai/chat' },
      { method: 'POST', path: '/transactions/import', name: 'POST /api/transactions/import' },
    ];

    for (const ep of protectedEndpoints) {
      const res = await fetch(`${baseUrl}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
        body: ep.method === 'POST' ? JSON.stringify({ message: 'hi' }) : undefined,
      });
      assert(res.status === 401, `${ep.name} returns 401 when unauthenticated`, `Got status ${res.status}`);
    }

    // ----------------------------------------------------
    // Part 2: User Isolation (User B gets 404 on User A data)
    // ----------------------------------------------------
    console.log('\n--- 2. User Isolation & 404 Ownership Check ---');

    const timestamp = Date.now();
    const userAEmail = `user_a_${timestamp}@test.local`;
    const userBEmail = `user_b_${timestamp}@test.local`;

    // 1. Register User A
    const regARes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userAEmail, name: 'User A', password: 'Password123!' }),
    });
    const cookieA = getCookie(regARes);
    assert(regARes.status === 201, 'User A registered successfully');

    // 2. Register User B
    const regBRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userBEmail, name: 'User B', password: 'Password123!' }),
    });
    const cookieB = getCookie(regBRes);
    assert(regBRes.status === 201, 'User B registered successfully');

    const headersA = { 'Content-Type': 'application/json', Cookie: cookieA };
    const headersB = { 'Content-Type': 'application/json', Cookie: cookieB };

    // 3. User A creates an Account
    const accRes = await fetch(`${baseUrl}/accounts`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ name: 'User A Secret Checking', type: 'DEPOSITORY', balance: 50000 }),
    });
    const accountA = await accRes.json();
    assert(accRes.status === 201 && accountA.id, 'User A created account');

    // Fetch existing categories for User A
    const catsRes = await fetch(`${baseUrl}/categories`, { headers: headersA });
    const categories = await catsRes.json();
    const expenseCat = categories.find((c: any) => c.type === 'EXPENSE') || categories[0];

    // 4. User A creates a Transaction
    const txnRes = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        accountId: accountA.id,
        categoryId: expenseCat.id,
        amount: 2500,
        date: new Date().toISOString().split('T')[0],
        type: 'EXPENSE',
        description: 'User A Confidential Purchase',
      }),
    });
    const transactionA = await txnRes.json();
    assert(txnRes.status === 201 && transactionA.id, 'User A created transaction');

    // 5. User A creates a Budget
    const now = new Date();
    const budgetRes = await fetch(`${baseUrl}/budgets`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        categoryId: expenseCat.id,
        amount: 10000,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      }),
    });
    const budgetA = await budgetRes.json();
    assert(budgetRes.status === 201 && budgetA.id, 'User A created budget');

    // 6. User A creates a Goal
    const goalRes = await fetch(`${baseUrl}/goals`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        name: 'User A Private Goal',
        targetAmount: 100000,
        savedAmount: 20000,
        deadline: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
      }),
    });
    const goalA = await goalRes.json();
    assert(goalRes.status === 201 && goalA.id, 'User A created goal');

    // -----------------------------------------------------------------
    // User B attempts to access User A's Account -> MUST RETURN 404
    // -----------------------------------------------------------------
    const bGetAcc = await fetch(`${baseUrl}/accounts/${accountA.id}`, { headers: headersB });
    assert(bGetAcc.status === 404, 'User B GET User A account -> 404 Not Found', `Got ${bGetAcc.status}`);

    const bPutAcc = await fetch(`${baseUrl}/accounts/${accountA.id}`, {
      method: 'PUT',
      headers: headersB,
      body: JSON.stringify({ name: 'Hacked Account', type: 'DEPOSITORY', balance: 0 }),
    });
    assert(bPutAcc.status === 404, 'User B PUT User A account -> 404 Not Found', `Got ${bPutAcc.status}`);

    const bDelAcc = await fetch(`${baseUrl}/accounts/${accountA.id}`, {
      method: 'DELETE',
      headers: headersB,
    });
    assert(bDelAcc.status === 404, 'User B DELETE User A account -> 404 Not Found', `Got ${bDelAcc.status}`);

    // -----------------------------------------------------------------
    // User B attempts to access User A's Transaction -> MUST RETURN 404
    // -----------------------------------------------------------------
    const bGetTxn = await fetch(`${baseUrl}/transactions/${transactionA.id}`, { headers: headersB });
    assert(bGetTxn.status === 404, 'User B GET User A transaction -> 404 Not Found', `Got ${bGetTxn.status}`);

    const bPutTxn = await fetch(`${baseUrl}/transactions/${transactionA.id}`, {
      method: 'PUT',
      headers: headersB,
      body: JSON.stringify({
        accountId: accountA.id,
        categoryId: expenseCat.id,
        amount: 999999,
        date: new Date().toISOString().split('T')[0],
        type: 'EXPENSE',
      }),
    });
    assert(bPutTxn.status === 404, 'User B PUT User A transaction -> 404 Not Found', `Got ${bPutTxn.status}`);

    const bDelTxn = await fetch(`${baseUrl}/transactions/${transactionA.id}`, {
      method: 'DELETE',
      headers: headersB,
    });
    assert(bDelTxn.status === 404, 'User B DELETE User A transaction -> 404 Not Found', `Got ${bDelTxn.status}`);

    // -----------------------------------------------------------------
    // User B attempts to access User A's Budget -> MUST RETURN 404
    // -----------------------------------------------------------------
    const bGetBudget = await fetch(`${baseUrl}/budgets/${budgetA.id}`, { headers: headersB });
    assert(bGetBudget.status === 404, 'User B GET User A budget -> 404 Not Found', `Got ${bGetBudget.status}`);

    const bDelBudget = await fetch(`${baseUrl}/budgets/${budgetA.id}`, {
      method: 'DELETE',
      headers: headersB,
    });
    assert(bDelBudget.status === 404, 'User B DELETE User A budget -> 404 Not Found', `Got ${bDelBudget.status}`);

    // -----------------------------------------------------------------
    // User B attempts to access User A's Goal -> MUST RETURN 404
    // -----------------------------------------------------------------
    const bGetGoal = await fetch(`${baseUrl}/goals/${goalA.id}`, { headers: headersB });
    assert(bGetGoal.status === 404, 'User B GET User A goal -> 404 Not Found', `Got ${bGetGoal.status}`);

    const bPutGoal = await fetch(`${baseUrl}/goals/${goalA.id}`, {
      method: 'PUT',
      headers: headersB,
      body: JSON.stringify({
        name: 'Hacked Goal',
        targetAmount: 1,
        savedAmount: 0,
        deadline: new Date().toISOString().split('T')[0],
      }),
    });
    assert(bPutGoal.status === 404, 'User B PUT User A goal -> 404 Not Found', `Got ${bPutGoal.status}`);

    const bDelGoal = await fetch(`${baseUrl}/goals/${goalA.id}`, {
      method: 'DELETE',
      headers: headersB,
    });
    assert(bDelGoal.status === 404, 'User B DELETE User A goal -> 404 Not Found', `Got ${bDelGoal.status}`);

    // -----------------------------------------------------------------
    // Part 3: Collection Leak Check (User B lists must not contain A's data)
    // -----------------------------------------------------------------
    console.log('\n--- 3. Collection Listing Isolation ---');

    const bAccountsList = await fetch(`${baseUrl}/accounts`, { headers: headersB }).then(r => r.json());
    assert(
      !bAccountsList.some((a: any) => a.id === accountA.id),
      'User B accounts list does not include User A account'
    );

    const bTxnList = await fetch(`${baseUrl}/transactions`, { headers: headersB }).then(r => r.json());
    assert(
      !bTxnList.data?.some((t: any) => t.id === transactionA.id),
      'User B transactions list does not include User A transaction'
    );

    const bBudgetSummary = await fetch(`${baseUrl}/budgets/summary`, { headers: headersB }).then(r => r.json());
    assert(
      !bBudgetSummary.summary?.some((b: any) => b.id === budgetA.id),
      'User B budget summary does not include User A budget'
    );

    const bGoalsList = await fetch(`${baseUrl}/goals`, { headers: headersB }).then(r => r.json());
    assert(
      !bGoalsList.some((g: any) => g.id === goalA.id),
      'User B goals list does not include User A goal'
    );

    const bDashboard = await fetch(`${baseUrl}/dashboard`, { headers: headersB }).then(r => r.json());
    assert(
      bDashboard.totalBalance === 0 && bDashboard.thisMonthExpense === 0 && bDashboard.thisMonthIncome === 0,
      'User B dashboard reflects zero activity (balance=0, income=0, expense=0), fully isolated from User A'
    );

  } catch (err: any) {
    console.error('Test runner encountered an error:', err);
    failed++;
  }

  return { passed, failed };
}

if (process.argv[1]?.endsWith('api-isolation.test.ts')) {
  runApiIsolationTests().then(({ passed, failed }) => {
    console.log(`\nAPI Isolation Tests Result: ${passed} Passed, ${failed} Failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
}
