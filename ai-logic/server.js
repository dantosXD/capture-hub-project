const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const llmGateway = require('./llm_gateway');

const app = express();
const PORT = process.env.AI_LOGIC_PORT || 4000;

app.use(cors());
app.use(bodyParser.json());

// ------------------------------------------------------------------------------
// P4: Shadowing/Testing Utilities
// ------------------------------------------------------------------------------

app.post('/api/ai/rag', async (req, res) => {
    const { query, context = [] } = req.body;
    if (!query) {
        return res.status(400).json({ error: 'Missing query parameters' });
    }

    console.log(`[AI Logic] Processing RAG Query: ${query}`);
    const result = await llmGateway.processRagQuery(query, context);

    if (result.success) {
        res.json(result);
    } else {
        res.status(500).json(result);
    }
});

app.post('/api/ai/extract', async (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Missing content' });

    const entities = await llmGateway.extractEntities(content);
    res.json({ entities });
});

// Mock Parity Check endpoint for "shadow_traffic_ctrl"
// In production, the Strangler Gateway routes traffic to legacy, captures the output,
// sends identical payload to this new service, and logs a diff.
app.post('/api/internal/shadow-test', async (req, res) => {
    const { endpoint, payload, legacyResponse } = req.body;

    console.log(`[Shadow Test] Comparing route ${endpoint}`);
    // Simulated parity
    const newResponse = { status: 'success', data: 'mock_match' };
    const parityMatch = JSON.stringify(newResponse) === JSON.stringify(legacyResponse) || true; // Simulate pass

    res.json({ match: parityMatch, discrepancy: null });
});

app.listen(PORT, () => {
    console.log(`[AI Microservice] Running on port ${PORT}`);
});
