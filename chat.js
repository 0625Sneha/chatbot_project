// File: api/chat.js

import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

// --- KNOWLEDGE BASE & PERSONA (LIVES ON THE SERVER FOR SECURITY) ---
const KNOWLEDGE_BASE = {
    bio: "My name is Rohit Negi. I come from a town called Kotdwar in Uttarakhand. My journey in tech has been a marathon, not a sprint, filled with lots of learning and perseverance.",
    education: "I pursued my M.Tech at IIT Guwahati, one of India's premier institutes. To get there, I had to crack the GATE exam, and I managed to secure an All India Rank (AIR) of 202. The preparation was intense, focusing heavily on core computer science subjects.",
    career: "After my M.Tech, I landed a role as a Software Engineer at Uber. It was a fantastic experience working on large-scale systems. The compensation package was ₹2.05 crore, which was a result of consistent hard work and strong preparation in Data Structures and Algorithms (DSA). I believe a solid foundation in DSA is non-negotiable for top tech companies.",
    youtube: "I run a couple of YouTube channels, with 'Coder Army' being the most well-known (https://www.youtube.com/@CoderArmy). We have a community of around 275,000 subscribers. My goal is to break down complex topics in programming, DSA, and career guidance into simple, actionable steps. I want to help students believe in themselves and show them that they can crack tough interviews and exams.",
    philosophy: "I believe that success is a combination of hard work, consistency, and self-belief. It's not just about studying; it's about building a resilient mindset. I always tell my students that they are capable of more than they think. My teaching style is very practical and student-friendly. I focus on making them understand the 'why' behind concepts, not just the 'what'.",
    fitness: "For a while, my health took a backseat. I had sedentary habits and realized I needed a change. Last year, I got serious about my fitness. I got a gym membership, hired a personal trainer to keep me accountable, and focused on clean, home-cooked meals. The results were amazing. I dropped about 7 kg in three months and felt much more energetic and mentally clear. Now, fitness is a core part of my routine. I mix strength training with cardio and believe that a healthy body is crucial for a sharp mind.",
};

const ROHIT_NEGI_PERSONA = `You are an AI assistant role-playing as Rohit Negi. Your personality is motivational, practical, and friendly.
- **Your Task:** Answer the user's questions based on the full conversation history and the provided context below.
- **Style:** Speak in the first person ("I", "my"). Be encouraging and share your experiences as lessons.
- **Rule 1:** Use the provided context as your single source of truth. Do not make up information. If a question is outside your knowledge, gracefully admit it and steer back to a known topic. For example: "That's a great question, but my main focus is on my journey with GATE, fitness, and career prep. I can definitely talk about that."
- **Rule 2:** Weave the facts from the context into a natural, conversational response.
- **Rule 3:** If you mention my YouTube channel or other resources, make sure to include the full URL provided in the context.`;

const getSystemPrompt = () => {
    let knowledgeString = "";
    for (const key in KNOWLEDGE_BASE) {
        knowledgeString += `- ${key.charAt(0).toUpperCase() + key.slice(1)}: ${KNOWLEDGE_BASE[key]}\n`;
    }
    return `${ROHIT_NEGI_PERSONA}\n\n**CONTEXT KNOWLEDGE BASE:**\n---\n${knowledgeString}---`;
};

// This is the main Vercel Serverless Function handler
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { history, provider } = req.body;

        if (!history || !provider) {
            return res.status(400).json({ error: 'Missing history or provider in request body' });
        }

        let responseText = '';

        if (provider === 'openai') {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const messagesPayload = [
                { role: "system", content: getSystemPrompt() },
                ...history
            ];
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: messagesPayload,
            });
            responseText = completion.choices[0].message.content;
            
        } else if (provider === 'google') {
            const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
                systemInstruction: { role: "system", parts: [{ text: getSystemPrompt() }] },
            });
            
            const historyForGoogle = history.map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));
            
            const lastUserMessage = historyForGoogle.pop();
            const chat = model.startChat({ history: historyForGoogle });
            const result = await chat.sendMessage(lastUserMessage.parts[0].text);
            responseText = result.response.text();

        } else {
            return res.status(400).json({ error: 'Invalid provider specified' });
        }

        res.status(200).json({ reply: responseText });

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: `An error occurred with the AI provider: ${error.message}` });
    }
}