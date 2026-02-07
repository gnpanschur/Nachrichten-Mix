
const assert = require('assert');

// The new logic to test
function getFormattedDateVienna(dateToCheck) {
    const formatter = new Intl.DateTimeFormat('de-AT', {
        timeZone: 'Europe/Vienna',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const parts = formatter.formatToParts(dateToCheck);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;

    return `${year}-${month}-${day}`;
}

async function runTests() {
    console.log("Starting Timezone Tests...");

    // 1. Test specific date/time (Winter Time)
    // 2026-02-07 00:30 UTC = 2026-02-07 01:30 CET (Vienna) -> Same Day
    // Wait, winter offset is UTC+1. 
    // So 2026-02-07 00:30 UTC is 2026-02-07 01:30 CET. Correct.
    // But what if it is 23:30 UTC on Feb 6?
    // 2026-02-06 23:30 UTC = 2026-02-07 00:30 CET.
    // Server sees Feb 6. Vienna sees Feb 7. THIS IS THE BUG CASE.

    const bugCaseDate = new Date('2026-02-06T23:30:00Z'); // UTC time
    const result = getFormattedDateVienna(bugCaseDate);

    console.log(`Test Case: 2026-02-06 23:30 UTC`);
    console.log(`Expected (Vienna): 2026-02-07`);
    console.log(`Actual: ${result}`);

    if (result === '2026-02-07') {
        console.log("✅ PASSED: Correctly identified next day in Vienna.");
    } else {
        console.error("❌ FAILED: Did not switch to next day.");
    }

    // 2. Test Summer Time
    // June 1st. UTC+2.
    // 2026-06-01 22:30 UTC = 2026-06-02 00:30 CEST.
    const summerBugCase = new Date('2026-06-01T22:30:00Z');
    const summerResult = getFormattedDateVienna(summerBugCase);

    console.log(`\nTest Case: 2026-06-01 22:30 UTC (Summer)`);
    console.log(`Expected (Vienna): 2026-06-02`);
    console.log(`Actual: ${summerResult}`);

    if (summerResult === '2026-06-02') {
        console.log("✅ PASSED: Correctly identified next day in Vienna (Summer).");
    } else {
        console.error("❌ FAILED: Did not switch to next day (Summer).");
    }

    // 3. Test "Yesterday" logic
    // Logic in server.js: 
    // viennaTodayStr = getFormattedDate(new Date()); 
    // viennaDate = new Date(viennaTodayStr + 'T12:00:00'); 
    // viennaDate.setDate(viennaDate.getDate() - 1);

    // Simulate "Now" is Bug Case
    const now = bugCaseDate;
    const viennaTodayStr = getFormattedDateVienna(now); // Should be 07
    const viennaDate = new Date(viennaTodayStr + 'T12:00:00'); // 2026-02-07T12:00:00 (Local System Time... tricky if running on UTC system)

    // Note: The logic in server.js relies on `new Date(string)` parsing.
    // If we parse '2026-02-07T12:00:00', it creates a date at noon LOCAL system time.
    // If local system is UTC, it's 12:00 UTC. 
    // If we subtract 1 day -> 2026-02-06 12:00 UTC.
    // Then getFormattedDateVienna(that date) -> 2026-02-06. 
    // So it works!

    viennaDate.setDate(viennaDate.getDate() - 1);
    const yesterdayResult = getFormattedDateVienna(viennaDate);

    console.log(`\nTest Case: Yesterday Calculation`);
    console.log(`If Today is (Vienna): ${viennaTodayStr}`);
    console.log(`Expected Yesterday: 2026-02-06`);
    console.log(`Actual Yesterday: ${yesterdayResult}`);

    if (yesterdayResult === '2026-02-06') {
        console.log("✅ PASSED: Yesterday correctly calculated.");
    } else {
        console.error("❌ FAILED: Yesterday calculation wrong.");
    }
}

runTests();
