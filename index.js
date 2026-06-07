const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const OpenAI = require("openai");

console.log("🚀 Starting bot...");

// ===== CONFIG =====
const TOKEN = "";
const TARGET_USER_ID = "";

// ✅ OPENROUTER SETUP
const openai = new OpenAI({
  apiKey: "",
  baseURL: "https://openrouter.ai/api/v1"
});

// ===== DISCORD CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== DATABASE =====
const DB_FILE = './data.json';
let db = { words: {}, messages: [] };

// load data if exists
if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE));
  } catch {
    console.log("⚠️ DB corrupted, resetting...");
  }
}

// ensure structure exists
if (!db.words) db.words = {};
if (!db.messages) db.messages = [];

// save db
function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ===== WORD EXTRACTION =====
function extractWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2);
}

// ===== FALLBACK (OLD SYSTEM) =====
function generateReply() {
  const words = Object.keys(db.words);

  if (words.length < 3) {
    return "yeah something chill honestly";
  }

  let reply = [];
  let length = Math.floor(Math.random() * 8) + 3;

  for (let i = 0; i < length; i++) {
    reply.push(words[Math.floor(Math.random() * words.length)]);
  }

  let sentence = reply.join(" ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

// ===== AI REPLY (REAL MIMIC) =====
async function generateAIReply(userMessage) {
  try {
    const examples = db.messages.slice(-20).join("\n");

    const prompt = `
You are copying a real Discord user.

Here are real messages they sent:
${examples}

Reply to:
"${userMessage}"

Rules:
- sound exactly like them
- same slang and vibe
- casual
- lowercase
- short (1 sentence)
- do NOT act like an AI
`;

    const response = await openai.chat.completions.create({
      model: "meta-llama/llama-3-8b-instruct",
      messages: [
        { role: "user", content: prompt }
      ]
    });

    return response.choices[0].message.content.trim();

  } catch (err) {
    console.error("❌ AI ERROR:", err);
    return generateReply(); // fallback if AI fails
  }
}

// ===== READY =====
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ===== MAIN =====
client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;

    const userId = message.author.id;
    console.log("Message from:", userId);

    // ✅ LEARN FROM TARGET USER
    if (userId === TARGET_USER_ID) {
      console.log("✅ Learning...");

      const words = extractWords(message.content);

      words.forEach(word => {
        if (!db.words[word]) db.words[word] = 0;
        db.words[word]++;
      });

      // ✅ store full messages
      db.messages.push(message.content);

      // 🧠 keep memory capped
      if (db.messages.length > 200) {
        db.messages.shift();
      }

      saveDB();
      return;
    }

    // ✅ REPLY
    console.log("💬 AI replying...");

    const reply = await generateAIReply(message.content);
    await message.reply(reply);

  } catch (err) {
    console.error("❌ ERROR:", err);
  }
});

// ===== START =====
client.login(TOKEN);
``