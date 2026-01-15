
import express from 'express';
import { GoogleGenAI } from "@google/genai";

const router = express.Router();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

router.post('/', async (req, res) => {
    const { text } = req.body;
    
    if (!text) return res.status(400).json({ error: 'Text required' });

    // Helper for fallback if API fails or key is missing
    const fallbackTranslate = (t) => ({
        cs: t,
        en: `[EN] ${t}`,
        uk: `[UK] ${t}`
    });

    if (!process.env.API_KEY) {
        console.warn("API_KEY not found in environment variables. Using mock translation.");
        return res.json(fallbackTranslate(text));
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const model = 'gemini-3-flash-preview';
        
        let response;
        let attempt = 0;
        const maxRetries = 3;

        while (attempt < maxRetries) {
            try {
                response = await ai.models.generateContent({
                    model: model,
                    contents: {
                        parts: [
                            { text: 'Translate the following text into Czech (key: "cs"), English (key: "en"), and Ukrainian (key: "uk"). Return strictly valid JSON object.' },
                            { text: text }
                        ]
                    },
                    config: {
                        responseMimeType: "application/json",
                    }
                });
                break; // Success, exit loop
            } catch (apiError) {
                attempt++;
                // Check for 503 (Overloaded) or 429 (Too Many Requests) in error message or status
                const isOverloaded = 
                    (apiError.status === 503) || 
                    (apiError.status === 429) ||
                    (apiError.message && (apiError.message.includes('503') || apiError.message.includes('overloaded')));

                if (isOverloaded && attempt < maxRetries) {
                    const delay = 1000 * Math.pow(2, attempt - 1); // 1000ms, 2000ms
                    console.warn(`Translation API overloaded/busy. Retrying in ${delay}ms (Attempt ${attempt}/${maxRetries})...`);
                    await sleep(delay);
                    continue;
                }
                
                throw apiError; // Fatal error or max retries reached
            }
        }

        const jsonStr = response?.text;
        
        if (jsonStr) {
            const translations = JSON.parse(jsonStr);
            res.json(translations);
        } else {
            console.warn("Gemini returned empty text response.");
            throw new Error("Empty response from AI");
        }

    } catch (error) {
        console.error("Translation API Error:", error.message);
        // Fallback to avoid breaking the app flow
        res.json(fallbackTranslate(text));
    }
});

export default router;
