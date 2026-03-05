require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({});

// Setup unified logic configuration
const FALLBACK_MODEL = 'gemini-2.5-flash';

async function processRagQuery(query, contextData) {
    try {
        const prompt = `Use the following context to answer the user query.\nContext: ${JSON.stringify(contextData)}\nUser Query: ${query}`;

        // In P4, this simulates the actual LLM Gateway logic parsing the vectors from the DB
        const response = await ai.models.generateContent({
            model: FALLBACK_MODEL,
            contents: prompt,
        });

        return {
            success: true,
            answer: response.text,
            model_used: FALLBACK_MODEL
        };
    } catch (err) {
        console.error('[LLM Gateway] RAG Query Failed:', err.message);
        return { success: false, error: err.message };
    }
}

async function extractEntities(captureContent) {
    const prompt = `Extract domains, people, dates, and action items from this text: "${captureContent}". Output strictly as JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: FALLBACK_MODEL,
            contents: prompt,
        });
        return JSON.parse(response.text.replace(/```json/g, '').replace(/```/g, ''));
    } catch (e) {
        console.warn("Entity extraction failed", e);
        return {};
    }
}

module.exports = {
    processRagQuery,
    extractEntities
};
