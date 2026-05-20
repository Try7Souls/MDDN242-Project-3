const { Client, GatewayIntentBits } = require('discord.js');

// Create bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 🔴 Put your bot token here
const TOKEN = "";

// When bot starts
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// When someone sends a message
client.on('messageCreate', (message) => {
  if (message.author.bot) return; // prevents infinite loop

  // Copy message
  message.channel.send(message.content);
});

// Start bot
client.login(TOKEN);