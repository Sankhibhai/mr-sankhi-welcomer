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

dataManager.initMissions(missions);
dataManager.initShopItems(shopItems);

const app = express();
app.get("/", (req, res) => res.send("MR.SANKHI-BOTS is alive!"));
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🌐 Server listening on port ${port}`);
});
setInterval(() => {
  fetch("https://mr-sankhi-welcomer-1.onrender.com").catch(() =>
    console.log("Ping failed")
  );
}, 5 * 60 * 1000);

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

require("./invite-tracker")(client);

client.on("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

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
    dataManager.addXP(userId, 100);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const userData = dataManager.getUser(userId);
  const msg = message.content.trim();
  const msgLower = msg.toLowerCase();
  const args = msg.split(" ");

  if (msgLower.startsWith("!givexp")) {
    if (message.author.id !== OWNER_ID) {
      return message.reply("❌ Ye command sirf bot owner ke liye hai.");
    }

    const targetUser = message.mentions.users.first();
    const amount = parseInt(args[2]);

    if (!targetUser || isNaN(amount)) {
      return message.reply("❌ Usage: `!givexp @user amount`");
    }

    const targetData = dataManager.getUser(targetUser.id);
    targetData.xp = (targetData.xp || 0) + amount;
    dataManager.saveData();

    return message.channel.send(`✅ ${targetUser.username} ko **${amount} XP** diya gaya hai!`);
  }

  if (msgLower.startsWith("!buy") && args[1] === "nicknameColor") {
    const colorChoice = args[2]?.toLowerCase();
    const itemCost = 1000;

    if (!["red", "blue", "green"].includes(colorChoice)) {
      return message.reply("❌ Please choose: `red`, `blue`, ya `green`");
    }

    const userXP = userData.xp || 0;
    if (userXP < itemCost) {
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
    const member = message.member;
    await member.roles.remove(
      member.roles.cache.filter((r) => allColorRoles.includes(r.name))
    );
    await member.roles.add(role);

    return message.channel.send(
      `✅ Aapne **${roleName}** purchase kar liya hai! Enjoy your color! 🎨`
    );
  }

  const randomXP = Math.floor(Math.random() * 6) + 5;
  dataManager.addXP(userId, randomXP);
});

client.on("voiceStateUpdate", (oldState, newState) => {
  if (newState.member.user.bot) return;

  const userId = newState.id;

  if (!oldState.channel && newState.channel) {
    voiceTimers.set(userId, Date.now());
  } else if (oldState.channel && !newState.channel) {
    const joinTime = voiceTimers.get(userId);
    if (joinTime) {
      const duration = (Date.now() - joinTime) / 1000;
      const xpToAdd = Math.floor(duration / 60) * 10;
      if (xpToAdd > 0) {
        dataManager.addXP(userId, xpToAdd);
        const guild = newState.guild;
        const member = guild.members.cache.get(userId);
        const xpChannel = guild.channels.cache.find((ch) => ch.name === "sankhi-xp");
        if (xpChannel) {
          xpChannel.send(
            `🎤 ${member.user.username} ne voice chat me ${Math.floor(duration / 60)} minute bitaye aur ${xpToAdd} XP paya!`
          );
        }
      }
      voiceTimers.delete(userId);
    }
  } else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
    voiceTimers.set(userId, Date.now());
  }
});

client.login(process.env.TOKEN);
