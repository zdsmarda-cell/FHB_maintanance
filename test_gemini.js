import { GoogleGenAI } from "@google/genai";

async function test() {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { text: 'Translate the following text into Czech (key: "cs"), English (key: "en"), and Ukrainian (key: "uk"). Return strictly valid JSON object.' },
                    { text: "Doplnění přívodního kabelu" }
                ]
            },
            config: {
                responseMimeType: "application/json",
            }
        });
        console.log(response.text);
    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();
