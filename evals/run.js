const fs = require('fs');
const path = require('path');

async function main() {
  const casesPath = path.join(__dirname, 'cases.json');
  const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
  const baseUrl = process.env.TRIAGE_URL || 'http://localhost:3000/triage';

  let matched = 0;

  for (const testCase of cases) {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: testCase.input })
    });

    const result = await response.json();
    const actual = result && result.category ? result.category : 'other';

    if (actual === testCase.expectedCategory) {
      matched += 1;
    }

    console.log(JSON.stringify({
      input: testCase.input,
      expectedCategory: testCase.expectedCategory,
      actualCategory: actual,
      ok: actual === testCase.expectedCategory
    }));
  }

  console.log(`${matched} out of ${cases.length} matched expectedCategory`);
}

main().catch((error) => {
  console.error('Eval run failed:', error);
  process.exitCode = 1;
});
