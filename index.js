require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder,
  Partials,
  Collection,
  PermissionsBitField,
} = require("discord.js");
const Canvas = require("canvas");
const express = require("express");
const fetch = require("node-fetch");
const dataManager = require("./dataManager");
const missions = require("./missions");
const shopItems = require("./shop");

// Initialize missions and shop data (only once, will be saved in data.json)
dataManager.initMissions(missions);
dataManager.initShopItems(shopItems);

// Express app for uptime
const app = express();
app.get("/", (req, res) => res.send("MR.SANKHI-BOTS is alive!"));

// Start HTTP server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🌐 Server listening on port ${port}`);
});

// Self-ping every 5 mins to stay alive on Render
setInterval(() => {
  fetch("https://mr-sankhi-welcomer-1.onrender.com").catch(() =>
    console.log("Ping failed")
  );
}, 5 * 60 * 1000); // every 5 minutes

// Discord client setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates, // For voice activity
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.GuildMember,
    Partials.User,
  ],
});

client.invites = new Collection();
client.xp = new Collection();

// Keep track of voice join times for XP
const voiceTimers = new Map();

require("./invite-tracker")(client);

client.on("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// Welcome image and invite XP (existing)
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.systemChannel;
  if (!channel) return;

  const canvas = Canvas.createCanvas(700, 250);
  const ctx = canvas.getContext("2d");

  const background = await Canvas.loadImage(
    "https://i.ibb.co/ymv6RPRD/TO-MR-SANKHI-BOTS-3.png"
  );
  ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.arc(125, 125, 100, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();

  const avatar = await Canvas.loadImage(
    member.user.displayAvatarURL({ extension: "jpg" })
  );
  ctx.drawImage(avatar, 25, 25, 200, 200);

  ctx.font = "bold 32px Sans";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`Welcome, ${member.user.username}!`, 250, 125);

  const attachment = new AttachmentBuilder(canvas.toBuffer(), {
    name: "welcome-image.png",
  });

  let inviter = client.invites.get(member.guild.id)?.get(member.id);
  let inviterTag = inviter ? inviter.user.tag : "Unknown";

  channel.send({
    content: `Hey ${member}, welcome to **${member.guild.name}**! 🎉\nInvited by **${inviterTag}**`,
    files: [attachment],
  });

  if (inviter && inviter.user) {
    const userId = inviter.user.id;
    dataManager.addXP(userId, 100); // invite XP bonus
    // You can send XP notification in sankhi-xp channel if you want (optional)
  }
});

// Message XP and commands
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const userData = dataManager.getUser(userId);

  // Add random XP for chatting
  const randomXP = Math.floor(Math.random() * 6) + 5;
  dataManager.addXP(userId, randomXP);

  const msg = message.content.trim();
  const msgLower = msg.toLowerCase();

  // Command handlers
  if (msgLower.startsWith("!xp")) {
    const mentionedUser = message.mentions.users.first();
    const targetUser = mentionedUser || message.author;
    const targetData = dataManager.getUser(targetUser.id);
    const xp = targetData.xp || 0;
    const level = Math.floor(xp / 1000) + 1;

    message.channel.send(
      `📊 **${targetUser.username}** ki XP hai **${xp}** aur Level hai **${level}** 🎯`
    );
  } else if (msgLower === "!level") {
    const xp = userData.xp || 0;
    const level = Math.floor(xp / 1000) + 1;
    message.reply(`⭐ Aapka current level hai **${level}** aur XP hai **${xp}**.`);
  } else if (msgLower === "!rank") {
    // Get all users sorted by XP descending
    const allUsers = Object.entries(dataManager.data.users);
    allUsers.sort((a, b) => b[1].xp - a[1].xp);
    const rank = allUsers.findIndex(([id]) => id === userId) + 1 || "N/A";
    const level = Math.floor(userData.xp / 1000) + 1;
    message.reply(
      `🎖️ Aapka rank hai **${rank}** server me.\nLevel: **${level}**, XP: **${userData.xp}**`
    );
  } else if (msgLower === "!topxp") {
    const allUsers = Object.entries(dataManager.data.users);
    allUsers.sort((a, b) => b[1].xp - a[1].xp);
    const top10 = allUsers.slice(0, 10);

    let description = "";
    for (let i = 0; i < top10.length; i++) {
      const [id, uData] = top10[i];
      const member = message.guild.members.cache.get(id);
      if (!member) continue;
      const level = Math.floor(uData.xp / 1000) + 1;
      description += `**${i + 1}. ${member.user.username}** - Level: **${level}**, XP: **${uData.xp}**\n`;
    }
    if (!description) description = "XP data available nahi hai abhi.";

    const embed = {
      color: 0x0099ff,
      title: "🏆 Top 10 XP Leaders",
      description: description,
      timestamp: new Date(),
      footer: { text: "MR.SANKHI-BOTS XP System" },
    };

    message.channel.send({ embeds: [embed] });
  } else if (msgLower.startsWith("!transferxp")) {
    const args = msg.split(" ");
    const mention = message.mentions.users.first();
    const amount = parseInt(args[2]);

    if (!mention || isNaN(amount) || amount <= 0) {
      return message.reply("❌ Usage: !transferxp @user amount");
    }

    if (userData.xp < amount) {
      return message.reply("❌ Aapke paas itni XP nahi hai!");
    }

    const receiverData = dataManager.getUser(mention.id);

    userData.xp -= amount;
    receiverData.xp += amount;
    dataManager.saveData();

    message.channel.send(
      `✅ **${message.author.username}** ne **${mention.username}** ko **${amount} XP** transfer kiya!`
    );
  } else if (msgLower.includes("@sankhi")) {
    message.reply("Haan boliye! MR.SANKHI-BOTS yahan hai madad ke liye! 🤖");
  }

  // Missions commands
  else if (msgLower === "!missions") {
    let response = "**Missions List:**\n";
    for (const [id, mission] of Object.entries(dataManager.data.missions)) {
      const completed = userData.missionsCompleted.includes(id);
      response += `- ${mission.description} (XP Reward: ${mission.xpReward}) ${
        completed ? "[✅ Completed]" : "[❌ Incomplete]"
      }\n`;
    }
    message.channel.send(response);
  } else if (msgLower.startsWith("!claim")) {
    const args = msg.split(" ");
    if (args.length < 2) return message.reply("❌ Usage: !claim <missionId>");

    const missionId = args[1];
    if (!dataManager.data.missions[missionId]) return message.reply("❌ Invalid mission ID.");

    if (userData.missionsCompleted.includes(missionId)) {
      return message.reply("❌ Aapne ye mission pehle hi claim kar liya hai.");
    }

    // For simplicity, allow claiming anytime (you can add validation logic here)
    dataManager.completeMission(userId, missionId);
    message.reply(
      `🎉 Mission claim kar diya! Aapko ${dataManager.data.missions[missionId].xpReward} XP mila hai!`
    );
  }

  // Shop commands
  else if (msgLower === "!shop") {
    let response = "**Shop Items:**\n";
    for (const [id, item] of Object.entries(dataManager.data.shopItems)) {
      response += `- ${id}: ${item.name} - ${item.description} (Cost: ${item.priceXP} XP)\n`;
    }
    message.channel.send(response);
  } else if (msgLower.startsWith("!buy")) {
    const args = msg.split(" ");
    if (args.length < 2) return message.reply("❌ Usage: !buy <itemId>");

    const itemId = args[1];
    const result = dataManager.buyItem(userId, itemId);
    if (!result.success) return message.reply(`❌ ${result.reason}`);

    message.reply(`✅ Aapne **${dataManager.data.shopItems[itemId].name}** purchase kar liya hai!`);
  }
});

// Voice XP Tracking: start timer on join, add XP on leave or move
client.on("voiceStateUpdate", (oldState, newState) => {
  // Ignore bots
  if (newState.member.user.bot) return;

  const userId = newState.id;

  // User joined a voice channel
  if (!oldState.channel && newState.channel) {
    voiceTimers.set(userId, Date.now());
  }
  // User left voice channel
  else if (oldState.channel && !newState.channel) {
    const joinTime = voiceTimers.get(userId);
    if (joinTime) {
      const duration = (Date.now() - joinTime) / 1000; // in seconds
      const xpToAdd = Math.floor(duration / 60) * 10; // 10 XP per minute
      if (xpToAdd > 0) {
        dataManager.addXP(userId, xpToAdd);
        const guild = newState.guild;
        const member = guild.members.cache.get(userId);
        const xpChannel = guild.channels.cache.find(ch => ch.name === "sankhi-xp");
        if (xpChannel) {
          xpChannel.send(
            `🎤 ${member.user.username} ne voice chat me ${Math.floor(duration / 60)} minute bitaye aur ${xpToAdd} XP paya!`
          );
        }
      }
      voiceTimers.delete(userId);
    }
  }
  // User switched voice channels - reset timer to now
  else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
    voiceTimers.set(userId, Date.now());
  }
});

client.login(process.env.TOKEN);
