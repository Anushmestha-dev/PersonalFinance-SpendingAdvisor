import { runUnitTests } from './unit.test';
import { runApiIsolationTests } from './api-isolation.test';

async function main() {
  console.log('====================================================');
  console.log('🚀 FINSENSE AUTOMATED TEST SUITE');
  console.log('   - Unit Tests: Balance, Budget Alerts, Forecast Outliers');
  console.log('   - API Tests: 401 Auth Enforcement & 404 User Isolation');
  console.log('====================================================');

  const unitResults = await runUnitTests();
  const apiResults = await runApiIsolationTests();

  const totalPassed = unitResults.passed + apiResults.passed;
  const totalFailed = unitResults.failed + apiResults.failed;

  console.log('\n====================================================');
  console.log(`🏁 TEST EXECUTION SUMMARY:`);
  console.log(`   Total Tests:  ${totalPassed + totalFailed}`);
  console.log(`   Passed:       ${totalPassed} ✅`);
  console.log(`   Failed:       ${totalFailed} ${totalFailed > 0 ? '❌' : ''}`);
  console.log('====================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
