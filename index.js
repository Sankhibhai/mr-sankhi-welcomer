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

const OWNER_ID = "1276171538378522704";

// Init data
dataManager.initMissions(missions);
dataManager.initShopItems(shopItems);

// Express keep-alive
const app = express();
app.get("/", (req, res) => res.send("MR.SANKHI-BOTS is alive!"));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🌐 Server running on port ${port}`));

// Periodic ping to keep awake (Render, Replit etc.)
setInterval(() => {
  fetch("https://mr-sankhi-welcomer-1.onrender.com").catch(() => console.log("Ping failed"));
}, 5 * 60 * 1000);

// Discord client setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
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
const voiceTimers = new Map();

// Invite tracker
require("./invite-tracker")(client);

// Bot Ready event
client.on("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// Welcome system with canvas image and inviter XP reward
client.on("guildMemberAdd", async (member) => {
  try {
    const channel = member.guild.systemChannel;
    if (!channel) return;

    const canvas = Canvas.createCanvas(700, 250);
    const ctx = canvas.getContext("2d");
    const background = await Canvas.loadImage("https://i.ibb.co/ymv6RPRD/TO-MR-SANKHI-BOTS-3.png");
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.arc(125, 125, 100, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();

    const avatar = await Canvas.loadImage(member.user.displayAvatarURL({ extension: "jpg" }));
    ctx.drawImage(avatar, 25, 25, 200, 200);

    ctx.font = "bold 32px Sans";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`Welcome, ${member.user.username}!`, 250, 125);

    const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: "welcome-image.png" });

    let inviter = client.invites.get(member.guild.id)?.get(member.id);
    let inviterTag = inviter ? inviter.user.tag : "Unknown";

    await channel.send({
      content: `Hey ${member}, welcome to **${member.guild.name}**! 🎉\nInvited by **${inviterTag}**`,
      files: [attachment],
    });

    if (inviter?.user) dataManager.addXP(inviter.user.id, 100);
  } catch (err) {
    console.error("Error in guildMemberAdd:", err);
  }
});

// Message-based XP system and commands
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const userData = dataManager.getUser(userId);
  const msg = message.content.trim();
  const msgLower = msg.toLowerCase();
  const args = msg.split(/\s+/);

  // Word-based XP gain
  const wordCount = args.length;
  if (wordCount > 0) {
    dataManager.addXP(userId, wordCount);
  }

  // Commands
  if (msgLower === "!xp") {
    return message.channel.send(`${message.author.username}, aapke paas abhi **${userData.xp || 0} XP** hai.`);
  }

  if (msgLower === "!shop") {
    const items = dataManager.getShopItems();
    if (!items || items.length === 0) {
      return message.channel.send("❌ Shop abhi khali hai.");
    }

    let shopMessage = "🛒 **SANKHI XP SHOP**\n";
    for (const item of items) {
      shopMessage += `\n🆔 **${item.id}** — ${item.name} (${item.price} XP)`;
    }

    return message.channel.send(shopMessage);
  }

  if (msgLower.startsWith("!givexp")) {
    if (message.author.id !== OWNER_ID) return message.reply("❌ Ye command sirf bot owner ke liye hai.");

    const targetUser = message.mentions.users.first();
    const amount = parseInt(args[2]);
    if (!targetUser || isNaN(amount)) return message.reply("❌ Usage: `!givexp @user amount`");

    const targetData = dataManager.getUser(targetUser.id);
    targetData.xp = (targetData.xp || 0) + amount;
    dataManager.saveData();
    return message.channel.send(`✅ ${targetUser.username} ko **${amount} XP** diya gaya hai!`);
  }

  if (msgLower.startsWith("!giftxp")) {
    const targetUser = message.mentions.users.first();
    const amount = parseInt(args[2]);
    if (!targetUser || isNaN(amount) || amount <= 0) return message.reply("❌ Usage: `!giftxp @user amount`");

    if ((userData.xp || 0) < amount) return message.reply("❌ Aapke paas itna XP nahi hai gift karne ke liye!");
    if (targetUser.id === userId) return message.reply("❌ Aap apne aap ko XP nahi de sakte!");

    userData.xp -= amount;
    const targetData = dataManager.getUser(targetUser.id);
    targetData.xp = (targetData.xp || 0) + amount;
    dataManager.saveData();
    return message.channel.send(`🎁 ${message.author.username} ne ${targetUser.username} ko **${amount} XP** gift kiya hai!`);
  }

  if (msgLower === "!topxp") {
    const allUsers = Object.entries(dataManager.data.users || {});
    if (allUsers.length === 0) return message.channel.send("❌ Koi XP data available nahi hai.");

    const sortedUsers = allUsers.sort((a, b) => (b[1].xp || 0) - (a[1].xp || 0)).slice(0, 10);
    let leaderboard = "🏆 **Top 10 XP Holders:**\n";
    for (let i = 0; i < sortedUsers.length; i++) {
      const [uId, uData] = sortedUsers[i];
      const member = message.guild.members.cache.get(uId);
      const username = member?.user.username || `User ID: ${uId}`;
      leaderboard += `**${i + 1}.** ${username} — ${uData.xp || 0} XP\n`;
    }

    return message.channel.send(leaderboard);
  }

  if (msgLower.startsWith("!buy") && args[1]?.toLowerCase() === "nicknamecolor") {
    const colorChoice = args[2]?.toLowerCase();
    const itemCost = 1000;
    if (!["red", "blue", "green"].includes(colorChoice)) {
      return message.reply("❌ Please choose: `red`, `blue`, ya `green`");
    }

    if ((userData.xp || 0) < itemCost) {
      return message.reply(`❌ Aapke paas kaafi XP nahi hai! Required: ${itemCost} XP`);
    }

    userData.xp -= itemCost;
    dataManager.saveData();

    const colorMap = {
      red: "Color - Red",
      blue: "Color - Blue",
      green: "Color - Green",
    };
    const discordColorMap = {
      red: "Red",
      blue: "Blue",
      green: "Green",
    };

    const roleName = colorMap[colorChoice];
    let role = message.guild.roles.cache.find((r) => r.name === roleName);
    if (!role) {
      role = await message.guild.roles.create({
        name: roleName,
        color: discordColorMap[colorChoice],
        reason: `Color role created for ${message.author.username}`,
      });
    }

    const allColorRoles = ["Color - Red", "Color - Blue", "Color - Green"];
    await message.member.roles.remove(
      message.member.roles.cache.filter((r) => allColorRoles.includes(r.name))
    );
    await message.member.roles.add(role);

    return message.channel.send(`✅ Aapne **${roleName}** purchase kar liya hai! Enjoy your color! 🎨`);
  }
});

// Voice XP system - XP for time spent in voice channel
client.on("voiceStateUpdate", (oldState, newState) => {
  if (newState.member?.user.bot) return;
  const userId = newState.id;

  if (!oldState.channel && newState.channel) {
    // User joined voice channel
    voiceTimers.set(userId, Date.now());
  } else if (oldState.channel && !newState.channel) {
    // User left voice channel
    const joinTime = voiceTimers.get(userId);
    if (joinTime) {
      const duration = (Date.now() - joinTime) / 1000; // seconds
      const xpToAdd = Math.floor(duration / 60) * 10; // 10 XP per minute
      if (xpToAdd > 0) {
        dataManager.addXP(userId, xpToAdd);

        const guild = newState.guild;
        const member = guild.members.cache.get(userId);
        const xpChannel = guild.channels.cache.find((ch) => ch.name === "sankhi-xp");
        if (xpChannel && member) {
          xpChannel.send(`🎤 ${member.user.username} ne voice chat me ${Math.floor(duration / 60)} minute bitaye aur ${xpToAdd} XP paya!`);
        }
      }

      voiceTimers.delete(userId);
    }
  } else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
    // User switched voice channels
    voiceTimers.set(userId, Date.now());
  }
});

// Bot login
client.login(process.env.TOKEN);
