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
app.listen(port, () => console.log(`🌐 Server running on port ${port}`));

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

// Level calculate karne wali function
function calculateLevel(xp) {
  if (xp < 1000) return 1;

  let level = 1;
  let requiredXP = 1000;

  while (xp >= requiredXP) {
    level++;
    requiredXP *= 2;
  }

  return level;
}

client.on("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
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
      content: `Hey ${member}, welcome to **${member.guild.name}**! 🎉\nInvited by **${inviterTag}**`,
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

  // !xp command
  if (msgLower === "!xp") {
    return message.channel.send(`${message.author.username}, aapke paas abhi **${userData.xp || 0} XP** hai.`);
  }

  // !xplevel command (new)
  if (msgLower.startsWith("!xplevel")) {
    let targetUser;
    if (message.mentions.users.size > 0) {
      targetUser = message.mentions.users.first();
    } else {
      targetUser = message.author;
    }

    const targetData = dataManager.getUser(targetUser.id);
    const level = calculateLevel(targetData.xp || 0);

    return message.channel.send(`${targetUser.username} ka XP level hai: **${level}**!`);
  }

  // !topxp command
  if (msgLower === "!topxp") {
    const allUsers = dataManager.getAllUsers();
    const topUsers = Object.entries(allUsers)
      .sort(([, a], [, b]) => (b.xp || 0) - (a.xp || 0))
      .slice(0, 10);

    const leaderboard = topUsers.map(([id, data], i) => `**${i + 1}.** <@${id}> — ${data.xp || 0} XP`).join("\n");
    return message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("\uD83C\uDFC6 Top XP Leaderboard")
          .setDescription(leaderboard || "No data available.")
          .setColor("Gold"),
      ],
    });
  }

  // !givexp command
  if (msgLower.startsWith("!givexp")) {
    if (message.author.id !== OWNER_ID) return;
    const member = message.mentions.members.first();
    const amount = parseInt(args[2]);
    if (!member || isNaN(amount)) {
      return message.reply("❌ Usage: !givexp @user amount");
    }
    dataManager.addXP(member.id, amount);
    return message.channel.send(`✅ ${member.user.username} ko ${amount} XP diya gaya hai!`);
  }

  // !giftxp command
  if (msgLower.startsWith("!giftxp")) {
    const member = message.mentions.members.first();
    const amount = parseInt(args[2]);
    if (!member || isNaN(amount)) {
      return message.reply("❌ Usage: !giftxp @user amount");
    }
    if ((userData.xp || 0) < amount) {
      return message.reply("❌ Aapke paas kaafi XP nahi hai!");
    }
    dataManager.removeXP(userId, amount);
    dataManager.addXP(member.id, amount);
    return message.channel.send(`✅ Aapne ${member.user.username} ko ${amount} XP gift kiya!`);
  }

  // !shop command - updated with Lottery Ticket
  if (msgLower === "!shop") {
    const items = [
      {
        name: "Lottery Ticket",
        priceXP: 100,
        description: "Buy Lottery Tickets to win random XP prizes! Use `!buy lottery <amount>`",
      },
      {
        name: "Nickname Color",
        priceXP: 1000,
        description: "Change your nickname color to Red, Blue, or Green. Use `!buy nickname <red|blue|green>`",
      },
    ];

    const shopDesc = items
      .map(
        (item, i) =>
          `**${i + 1}. ${item.name}**\nPrice: ${item.priceXP} XP\n${item.description}`
      )
      .join("\n\n");

    const shopEmbed = new EmbedBuilder()
      .setTitle("\uD83D\uDED2 SANKHI XP SHOP")
      .setDescription(shopDesc)
      .setColor("Blue");

    return message.channel.send({ embeds: [shopEmbed] });
  }

  // !buy command - handle lottery and nickname
  if (msgLower.startsWith("!buy")) {
    const itemIdRaw = args[1]?.toLowerCase();
    const option = args[2]?.toLowerCase();
    const amount = parseInt(args[2]) || 1; // for lottery tickets amount

    if (!itemIdRaw) {
      return message.reply("❌ Usage: !buy <item> [option/amount]");
    }

    // Buy lottery tickets
    if (itemIdRaw === "lottery") {
      // amount is args[2]
      if (isNaN(amount) || amount < 1) {
        return message.reply("❌ Usage: !buy lottery <amount>");
      }

      const pricePerTicket = 100;
      const totalCost = pricePerTicket * amount;

      if ((userData.xp || 0) < totalCost) {
        return message.reply(`❌ Aapke paas ${totalCost} XP nahi hai!`);
      }

      userData.xp -= totalCost;
      userData.lotteryTickets = (userData.lotteryTickets || 0) + amount;

      dataManager.saveData();

      return message.channel.send(
        `✅ Aapne ${amount} Lottery Ticket(s) kharid liye! Total Tickets: ${userData.lotteryTickets}`
      );
    }

    // Buy nickname color
    if (itemIdRaw === "nickname") {
      if (!option) {
        return message.reply("❌ Usage: !buy nickname <red|blue|green>");
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

    return message.reply("❌ Invalid item.");
  }

  // !lottery or !spin command to use lottery tickets
  if (msgLower === "!lottery" || msgLower === "!spin") {
    if ((userData.lotteryTickets || 0) < 1) {
      return message.reply("❌ Aapke paas koi Lottery Ticket nahi hai. Pehle !buy lottery karke ticket khariden.");
    }

    userData.lotteryTickets -= 1;

    // Prize chances and ranges:
    // 50% chance -> 0 to 50 XP
    // 25% chance -> 50 to 100 XP
    // 12.5% chance -> 100 to 1000 XP
    // 10% chance -> 1000 to 2500 XP
    // 2.5% chance -> 2500 to 5000 XP

    const rand = Math.random() * 100;
    let prizeXP = 0;

    if (rand < 50) {
      // 0-50 XP
      prizeXP = Math.floor(Math.random() * 51);
    } else if (rand < 75) {
      // 50-100 XP
      prizeXP = 50 + Math.floor(Math.random() * 51);
    } else if (rand < 87.5) {
      // 100-1000 XP
      prizeXP = 100 + Math.floor(Math.random() * 901);
    } else if (rand < 97.5) {
      // 1000-2500 XP
      prizeXP = 1000 + Math.floor(Math.random() * 1501);
    } else {
      // 2500-5000 XP
      prizeXP = 2500 + Math.floor(Math.random() * 2501);
    }

    dataManager.addXP(userId, prizeXP);
    dataManager.saveData();

    return message.channel.send(`🎉 Aapne lottery jeeta: **${prizeXP} XP!** 🎊`);
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
