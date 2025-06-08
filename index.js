require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder,
  Partials,
  Collection,
  EmbedBuilder,
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
app.listen(port, () => console.log(`\uD83C\uDF10 Server running on port ${port}`));

setInterval(() => {
  fetch("https://mr-sankhi-welcomer-1.onrender.com").catch(() => console.log("Ping failed"));
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

client.on("ready", () => {
  console.log(`\uD83E\uDD16 Logged in as ${client.user.tag}`);
});

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
      content: `Hey ${member}, welcome to **${member.guild.name}**! \uD83C\uDF89\nInvited by **${inviterTag}**`,
      files: [attachment],
    });

    if (inviter?.user) dataManager.addXP(inviter.user.id, 100);
  } catch (err) {
    console.error("Error in guildMemberAdd:", err);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const userData = dataManager.getUser(userId);
  const msg = message.content.trim();
  const msgLower = msg.toLowerCase();
  const args = msg.split(/\s+/);

  const wordCount = args.length;
  if (wordCount > 0) {
    dataManager.addXP(userId, wordCount);
  }

  if (msgLower === "!xp") {
    return message.channel.send(`${message.author.username}, aapke paas abhi **${userData.xp || 0} XP** hai.`);
  }

  if (msgLower === "!shop") {
    const item = {
      priceXP: 1000,
      name: "Nickname Color",
      description: "Change your nickname color to Red, Blue, or Green."
    };

    const shopEmbed = new EmbedBuilder()
      .setTitle("\uD83D\uDED2 SANKHI XP SHOP")
      .setDescription("Use `!buy nickname <red|blue|green>` to change your nickname color.")
      .addFields([
        {
          name: `\uD83C\uDD94 nickname — Nickname Color (Red, Blue, Green)`,
          value: `\uD83D\uDCB8 ${item.priceXP} XP\n\uD83D\uDCCC ${item.description}`,
        }
      ])
      .setColor("Blue");

    return message.channel.send({ embeds: [shopEmbed] });
  }

  if (msgLower.startsWith("!buy")) {
    const itemIdRaw = args[1]?.toLowerCase();
    const option = args[2]?.toLowerCase();

    if (!itemIdRaw || !option) {
      return message.reply("❌ Usage: !buy nickname <red|blue|green>");
    }

    if (itemIdRaw !== "nickname") {
      return message.reply("❌ Currently only `nickname` item is available to buy.");
    }

    if (!["red", "blue", "green"].includes(option)) {
      return message.reply("❌ Please choose: `red`, `blue`, ya `green`");
    }

    const itemCost = 1000;
    if ((userData.xp || 0) < itemCost) {
      return message.reply(`❌ Aapke paas kaafi XP nahi hai! Required: ${itemCost} XP`);
    }

    userData.xp -= itemCost;
    dataManager.saveData();

    const colorMap = {
      red: "Colour - red",
      blue: "Colour - blue",
      green: "Colour - green",
    };

    const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === colorMap[option].toLowerCase());
    if (!role) {
      return message.reply(`❌ Role \"${colorMap[option]}\" server me nahi mila.`);
    }

    const allColorRoles = Object.values(colorMap);
    await message.member.roles.remove(
      message.member.roles.cache.filter(r => allColorRoles.includes(r.name))
    );

    await message.member.roles.add(role);

    return message.channel.send(`✅ Aapko **${colorMap[option]}** role mil gaya hai!`);
  }
});

client.on("voiceStateUpdate", (oldState, newState) => {
  if (newState.member?.user.bot) return;
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
        if (xpChannel && member) {
          xpChannel.send(`\uD83C\uDFA4 ${member.user.username} ne voice chat me ${Math.floor(duration / 60)} minute bitaye aur ${xpToAdd} XP paya!`);
        }
      }

      voiceTimers.delete(userId);
    }
  } else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
    voiceTimers.set(userId, Date.now());
  }
});

client.login(process.env.TOKEN);
