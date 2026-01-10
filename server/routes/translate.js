
import express from 'express';
import { GoogleGenAI, Type } from "@google/genai";

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
        
        // Use a model recommended for basic text tasks
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Translate the following text into Czech (key: "cs"), English (key: "en"), and Ukrainian (key: "uk"). 
            Ensure the output is strictly valid JSON format without markdown code blocks.
            If the input is short (like a name), treat it as a UI label.
            
            Text to translate: "${text}"`,
            config: {
                responseMimeType: "application/json",
                // Explicitly defining schema ensures strict JSON output matching our interface
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        cs: { type: Type.STRING },
                        en: { type: Type.STRING },
                        uk: { type: Type.STRING }
                    },
                    required: ['cs', 'en', 'uk']
                }
            }
        });

        const jsonStr = response.text;
        
        if (jsonStr) {
            const translations = JSON.parse(jsonStr);
            res.json(translations);
        } else {
            throw new Error("Empty response from AI");
        }

    } catch (error) {
        console.error("Translation API Error:", error);
        // Fallback to avoid breaking the app flow
        res.json(fallbackTranslate(text));
    }
});

export default router;
