const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const OpenAI = require("openai");

console.log("🚀 Starting bot...");

// ===== CONFIG =====
const TOKEN = "YOUR_DISCORD_BOT_TOKEN";
const TARGET_USER_ID = "562848176793714719";

// ===== OPENROUTER =====
const openai = new OpenAI({
  apiKey: "YOUR_OPENROUTER_API_KEY",
  baseURL: "https://openrouter.ai/api/v1"
});

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== DATABASE =====
const DB_FILE = './data.json';

let db = { chain: {}, messages: [] };

if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE));
  } catch {
    console.log("⚠️ DB corrupted, resetting...");
  }
}

if (!db.chain) db.chain = {};
if (!db.messages) db.messages = [];

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ===== WORD EXTRACT =====
function extractWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 1);
}

// ===== LEARN =====
function learnMessage(text) {
  const words = extractWords(text);

  for (let i = 0; i < words.length - 1; i++) {
    const current = words[i];
    const next = words[i + 1];

    if (!db.chain[current]) db.chain[current] = [];
    db.chain[current].push(next);
  }

  db.messages.push(text);
  if (db.messages.length > 500) db.messages.shift();

  saveDB();
}

// ===== MARKOV =====
function generateMarkovReply() {
  const keys = Object.keys(db.chain);
  if (keys.length < 2) return "idk";

  let word = keys[Math.floor(Math.random() * keys.length)];
  let result = [word];

  for (let i = 0; i < 8; i++) {
    const next = db.chain[word];
    if (!next) break;
    word = next[Math.floor(Math.random() * next.length)];
    result.push(word);
  }

  return result.join(" ");
}

// ===== AI REPLY =====
async function generateAIReply(userMessage) {
  try {
    const recent = db.messages.slice(-80);
    const examples = recent.join("\n");

    const anchor =
      recent[Math.floor(Math.random() * recent.length)] || "idk";

    const prompt = `
you are a real discord user, not an ai.

rules:
- 1 sentence only
- 3 to 10 words
- lowercase only
- casual tone
- MUST respond to the message
- match the type of message
- if greeting → greet back
- if question → answer simply
- if statement → react
- if short message → reply short
- dont give random unrelated replies
- dont overuse "idk"

examples:
${examples}

style reference:
"${anchor}"

message:
"${userMessage}"

reply like a real person:
`;

    const response = await openai.chat.completions.create({
      model: "meta-llama/llama-3-8b-instruct",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      top_p: 0.9,
      frequency_penalty: 1.0,
      presence_penalty: 0.6,
      max_tokens: 50
    });

    let reply = response.choices[0].message.content.trim();

    // ===== CLEANUP =====
    reply = reply.replace(/["']/g, "").replace(/\n/g, "").trim();

    // ✅ Fix 1: keep ONE sentence only
    reply = reply.split(/[.!?]/)[0].trim();

    // ✅ Fix 2: remove repeated words
    let words = reply.split(" ");
    let cleanWords = [];
    for (let i = 0; i < words.length; i++) {
      if (words[i] !== words[i - 1]) {
        cleanWords.push(words[i]);
      }
    }
    reply = cleanWords.join(" ");

    // ✅ Fix 5: filter bad outputs
    const badPatterns = [
      "doesnt sound right now",
      "by that",
      "seems weird bro thats crazy"
    ];

    if (badPatterns.some(p => reply.includes(p))) {
      console.log("⚠️ filtered bad reply:", reply);
      return generateMarkovReply();
    }

    // extra safety
    if (reply.length < 3) return generateMarkovReply();
    if (reply.split(" ").length === 1 && reply !== "idk") {
      return generateMarkovReply();
    }

    return reply;

  } catch (err) {
    console.error("❌ AI ERROR:", err);
    return generateMarkovReply();
  }
}

// ===== READY =====
client.once('clientReady', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ===== MAIN =====
client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;

    const msg = message.content.toLowerCase().trim();

    // ✅ instant greeting handler
    if (["hello", "hi", "hey", "heya"].includes(msg)) {
      const replies = ["hey", "hi", "heya", "yo"];
      return message.channel.send(
        replies[Math.floor(Math.random() * replies.length)]
      );
    }

    // ✅ always learn from target user
    if (message.author.id === TARGET_USER_ID) {
      learnMessage(message.content);
      console.log("📚 learned:", message.content);
    }

    // ✅ slight learning from others
    if (Math.random() < 0.2) {
      learnMessage(message.content);
    }

    // ✅ variable delay (0.5s - 4.5s)
    const delay = 500 + Math.random() * 4000;
    await message.channel.sendTyping();
    await new Promise(r => setTimeout(r, delay));

    // ✅ generate reply
    let reply;

    if (Math.random() < 0.85) {
      reply = await generateAIReply(message.content);
    } else {
      reply = generateMarkovReply();
    }

    // ✅ human imperfections
    if (Math.random() < 0.15) reply += " lol";
    if (Math.random() < 0.1) reply = reply.replace(/o/g, "oo");

    // ✅ send without ping
    return message.channel.send(reply);

  } catch (err) {
    console.error("❌ ERROR:", err);
  }
});

// ===== START =====
client.login(TOKEN);