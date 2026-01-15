
import express from 'express';
import { GoogleGenAI } from "@google/genai";

const router = express.Router();

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
        
        // Use gemini-3-flash-preview as recommended
        // We structure contents as parts to safely separate instruction from user input
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { text: 'Translate the following text into Czech (key: "cs"), English (key: "en"), and Ukrainian (key: "uk"). Return strictly valid JSON object.' },
                    { text: text }
                ]
            },
            config: {
                responseMimeType: "application/json",
                // Removed strict responseSchema to prevent "Empty response" errors on simple inputs
            }
        });

        const jsonStr = response.text;
        
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
