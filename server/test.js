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
    // 1. Register User A
    const resA = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `usera-${Date.now()}@example.com`, name: 'User A', password: 'password123' })
    });
    const cookieA = resA.headers.get('set-cookie');
    const userA = await resA.json();
    assert(resA.status === 201, 'Registered User A');

    // 2. Register User B
    const resB = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `userb-${Date.now()}@example.com`, name: 'User B', password: 'password123' })
    });
    const cookieB = resB.headers.get('set-cookie');
    assert(resB.status === 201, 'Registered User B');

    const headersA = { 'Content-Type': 'application/json', 'Cookie': cookieA };
    const headersB = { 'Content-Type': 'application/json', 'Cookie': cookieB };

    // 3. User A creates account
    const accRes = await fetch(`${baseUrl}/accounts`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ name: 'Test Checking', type: 'DEPOSITORY', balance: 1000 })
    });
    const accountA = await accRes.json();
    assert(accRes.status === 201, 'User A created account');

    // 4. User A creates category
    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({ name: 'Custom Cat', type: 'EXPENSE' })
    });
    const categoryA = await catRes.json();
    assert(catRes.status === 201, 'User A created custom category');

    // 5. User A creates transactions
    const txnRes = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: headersA,
      body: JSON.stringify({
        accountId: accountA.id,
        categoryId: categoryA.id,
        amount: 50,
        date: new Date().toISOString(),
        type: 'EXPENSE',
        description: 'Test coffee'
      })
    });
    const transactionA = await txnRes.json();
    assert(txnRes.status === 201, 'User A created transaction');

    await fetch(`${baseUrl}/transactions`, {
      method: 'POST', headers: headersA,
      body: JSON.stringify({ accountId: accountA.id, categoryId: categoryA.id, amount: 100, date: new Date().toISOString(), type: 'EXPENSE', description: 'Test grocery' })
    });

    // 6. Filters, search, pagination
    const searchRes = await fetch(`${baseUrl}/transactions?search=coffee&page=1&limit=1`, { headers: headersA });
    const searchData = await searchRes.json();
    assert(searchRes.status === 200 && searchData.data.length === 1 && searchData.data[0].description === 'Test coffee', 'Filters, search, and pagination work');

    // 7. User B tries to read User A's account
    const bReadAcc = await fetch(`${baseUrl}/accounts/${accountA.id}`, { headers: headersB });
    assert(bReadAcc.status === 404, 'User B gets 404 reading User A data');

    // 8. User B tries to edit User A's transaction
    const bEditTxn = await fetch(`${baseUrl}/transactions/${transactionA.id}`, {
      method: 'PUT', headers: headersB,
      body: JSON.stringify({ accountId: accountA.id, categoryId: categoryA.id, amount: 99, date: new Date().toISOString(), type: 'EXPENSE' })
    });
    assert(bEditTxn.status === 404, 'User B gets 404 editing User A data');

    // 9. User B tries to delete User A's category
    const bDelCat = await fetch(`${baseUrl}/categories/${categoryA.id}`, { method: 'DELETE', headers: headersB });
    assert(bDelCat.status === 404, 'User B gets 404 deleting User A data');

    // 10. Invalid input: Negative amount
    const badAmtRes = await fetch(`${baseUrl}/transactions`, {
      method: 'POST', headers: headersA,
      body: JSON.stringify({ accountId: accountA.id, categoryId: categoryA.id, amount: -50, date: new Date().toISOString(), type: 'EXPENSE' })
    });
    assert(badAmtRes.status === 400, 'Zod rejects negative amount');

    // 11. Invalid input: Bad date
    const badDateRes = await fetch(`${baseUrl}/transactions`, {
      method: 'POST', headers: headersA,
      body: JSON.stringify({ accountId: accountA.id, categoryId: categoryA.id, amount: 50, date: 'not-a-date', type: 'EXPENSE' })
    });
    assert(badDateRes.status === 400, 'Zod rejects bad date');

  } catch (e) {
    console.error("Test script crashed:", e);
  }

  console.log(`\nSummary: ${passed} Passed, ${failed} Failed`);
}

runTests();
