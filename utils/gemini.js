// To run this code you need to install the following dependencies:
// npm install @google/genai mime
// npm install -D @types/node

import {
    GoogleGenAI,
} from '@google/genai';

async function main(data) {
    const ai = new GoogleGenAI({
        apiKey: process.env.geminiAPI,
    });
    const tools = [
        {
            googleSearch: {
            }
        },
    ];
    const config = {
        thinkingConfig: {
            thinkingBudget: 0,
        },
        tools,
    };
    const model = 'gemini-flash-lite-latest';
    const contents = [
        {
            role: 'user',
            parts: [
                {
                    text: `give me the relation between the soil data and the crops order in 4 lines:${JSON.stringify(data, null, 2)}`,
                },
            ],
        },
    ];

    const response = await ai.models.generateContentStream({
        model,
        config,
        contents,
    });
    let filetext = '';
    for await (const chunk of response) {
        if (chunk.text) {
            filetext += chunk.text;
        }
    }
    return filetext;
}
export default main;