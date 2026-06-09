const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const SLOW_TEST_COUNT = 20;
const cwd = process.cwd();

// --- Slowest tests ---
try {
  const results = JSON.parse(
    readFileSync(resolve(cwd, 'coverage', 'test-results.json'), 'utf8')
  );

  const tests = results.testResults.flatMap((f) =>
    f.assertionResults.map((a) => ({
      name: `${f.name
        .replaceAll('\\', '/')
        .replace(cwd.replaceAll('\\', '/'), '.')} > ${[
        ...a.ancestorTitles,
        a.title,
      ].join(' > ')}`,
      ms: a.duration ?? 0,
    }))
  );

  tests.sort((a, b) => b.ms - a.ms);
  const top = tests.slice(0, SLOW_TEST_COUNT);

  console.log(`\n  Top ${top.length} slowest tests:\n`);
  for (const [i, t] of top.entries()) {
    console.log(`  ${String(i + 1).padStart(2)}. ${t.ms.toFixed(1)} ms  ${t.name}`);
  }
} catch (e) {
  console.error('  Could not read test results:', e.message);
}

// --- Coverage summary ---
try {
  const summary = JSON.parse(
    readFileSync(resolve(cwd, 'coverage', 'coverage-summary.json'), 'utf8')
  );
  const t = summary.total;

  console.log('\n  Coverage summary:');
  console.log(`    Statements : ${t.statements.pct}%`);
  console.log(`    Branches   : ${t.branches.pct}%`);
  console.log(`    Functions  : ${t.functions.pct}%`);
  console.log(`    Lines      : ${t.lines.pct}%`);
  console.log();
} catch (e) {
  console.error('  Could not read coverage summary:', e.message);
}
