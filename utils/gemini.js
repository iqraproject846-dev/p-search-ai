// utils/gemini.js — Gemini API with key rotation (same as frontend logic)
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Load all keys from .env
const API_KEYS = [
  process.env.GEMINI_KEY_1,
  process.env.GEMINI_KEY_2,
  process.env.GEMINI_KEY_3,
  process.env.GEMINI_KEY_4,
  process.env.GEMINI_KEY_5,
  process.env.GEMINI_KEY_6,
  process.env.GEMINI_KEY_7,
  process.env.GEMINI_KEY_8,  // ← ADD
  process.env.GEMINI_KEY_9,  // ← ADD

].filter(Boolean);

let currentKeyIndex = 0;

const MODEL_CONFIGS = {
  default: {
    name: "P-Search AI",
    systemInstruction: `You are P-Search AI.
- Always reply like a real human
- Friendly, natural, clear
- Be helpful and polite
- Language user ke hisab se use karo
- Short and precise replies
- Always reply in UK English, no matter what language user uses.`.trim(),
  },
};

/**
 * Generate AI response for a conversation
 * @param {Array}  messages   - [{sender:"user"|"ai", text:"...", image?:"base64"}]
 * @param {String} modelKey   - "default" | other model keys
 * @param {Object} fileData   - optional { data: base64, type: mimeType, name: string }
 * @returns {String}           AI response text
 */
async function generateAIResponse(messages, modelKey = "default", fileData = null) {
  const config = MODEL_CONFIGS[modelKey] || MODEL_CONFIGS.default;
  let attempts = API_KEYS.length;

  while (attempts-- > 0) {
    try {
      const genAI  = new GoogleGenerativeAI(API_KEYS[currentKeyIndex]);
      const model  = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: config.systemInstruction,
      });

      // Build contents array — same structure as frontend
      const contents = messages.map((msg) => {
        const parts = [];

        // Image in message
        if (msg.image && msg.image.startsWith("data:")) {
          const [meta, b64] = msg.image.split(",");
          const mimeType    = meta.match(/:(.*?);/)?.[1] || "image/jpeg";
          parts.push({ inlineData: { data: b64, mimeType } });
        }

        if (msg.text) parts.push({ text: msg.text });
        if (parts.length === 0) parts.push({ text: "" });

        return { role: msg.sender === "user" ? "user" : "model", parts };
      });

      // Attach latest file if provided (last user message)
      if (fileData && contents.length > 0) {
        const last = contents[contents.length - 1];
        if (last.role === "user") {
          const [, b64] = fileData.data.split(",");
          last.parts.unshift({ inlineData: { data: b64, mimeType: fileData.type } });
        }
      }

      const result   = await model.generateContent({ contents });
      const response = result.response.text();
      return response;

    } catch (err) {
      console.warn(`⚠️ Gemini key[${currentKeyIndex}] failed:`, err.message);
      currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;

      if (attempts === 0) throw new Error("All Gemini API keys exhausted");
    }
  }
}

/**
 * Generate a short chat title from the first user message
 */
async function generateChatTitle(firstMessage) {
  try {
    const genAI = new GoogleGenerativeAI(API_KEYS[currentKeyIndex]);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{
          text: `Generate a very short (3-5 words) chat title for this message. Return only the title, nothing else:\n\n"${firstMessage}"`,
        }],
      }],
    });

    return result.response.text().trim().replace(/^["']|["']$/g, "");
  } catch (err) {
    console.warn("Title generation failed:", err.message);
    return firstMessage.substring(0, 40) + (firstMessage.length > 40 ? "..." : "");
  }
}

module.exports = { generateAIResponse, generateChatTitle };
