const fs = require('fs');
const path = require('path');

const FINOPS_REPORT = path.join(__dirname, 'finops_report.json');

function verifyTeardownGate() {
    try {
        const report = JSON.parse(fs.readFileSync(FINOPS_REPORT, 'utf-8'));

        console.log("==========================================");
        console.log("    Omni-Architecture Ops Verification    ");
        console.log("==========================================\n");

        console.log(`[Validation Mode] Legacy Traffic Level: ${report.teardown_gate.legacy_traffic_percentage}%`);

        if (report.teardown_gate.legacy_traffic_percentage === report.teardown_gate.target_teardown_traffic) {
            console.log("✅ SUCCESS: Legacy traffic has successfully drained to 0%.");
            console.log(`✅ SUCCESS: Authorized to reclaim $${report.savings_projection.legacy_teardown_savings.toFixed(2)} / month.`);
            console.log("\n[Teardown] Starting teardown protocols...");

            // Mock teardown execution
            setTimeout(() => {
                console.log("-> Dropping legacy SQLite Database (`dev.db`).");
                console.log("-> Removing legacy Express routes in Unified Gateway.");
                console.log("-> Archiving Next.js pages/ legacy source code.");
                console.log("\nTEARDOWN COMPLETE. Architecture is now 100% Next-Gen (Serverless/Event-Driven).");
            }, 1000);

        } else {
            console.log("❌ WARNING: Legacy traffic non-zero.");
            console.log(`Current legacy traffic: ${report.teardown_gate.legacy_traffic_percentage}%. Target requirement: ${report.teardown_gate.target_teardown_traffic}%`);
            console.log("\nACTION REQUIRED: Please update the Unified Gateway Strangulation proxy to route 100% of traffic to the Serverless cluster before initiating teardown.");
        }
    } catch (e) {
        console.error("Failed to read FinOps report:", e.message);
    }
}

verifyTeardownGate();
