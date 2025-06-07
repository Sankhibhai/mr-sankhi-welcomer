require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder,
  Partials,
  Collection,
} = require("discord.js");
const Canvas = require("canvas");
const express = require("express");
const fetch = require("node-fetch");

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
  fetch("https://your-render-url.onrender.com/").catch(() =>
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
    const prevXP = client.xp.get(userId) || 0;
    const newXP = prevXP + 100;

    client.xp.set(userId, newXP);
    const level = Math.floor(newXP / 1000) + 1;

    const xpChannel = member.guild.channels.cache.find(
      (ch) => ch.name === "sankhi-xp"
    );
    if (xpChannel) {
      xpChannel.send(
        `🎉 **${inviter.user.username}** ne ek user ko invite kiya!\nTotal XP: **${newXP}**, Level: **${level}**`
      );
    }
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const prevXP = client.xp.get(userId) || 0;
  const randomXP = Math.floor(Math.random() * 6) + 5;
  const newXP = prevXP + randomXP;
  client.xp.set(userId, newXP);

  const msg = message.content.trim();
  const msgLower = msg.toLowerCase();

  if (msgLower.startsWith("!xp")) {
    const mentionedUser = message.mentions.users.first();
    const targetUser = mentionedUser || message.author;
    const xp = client.xp.get(targetUser.id) || 0;
    const level = Math.floor(xp / 1000) + 1;

    message.channel.send(
      `📊 **${targetUser.username}** ki XP hai **${xp}** aur Level hai **${level}** 🎯`
    );
  } else if (msgLower === "!level") {
    const level = Math.floor(newXP / 1000) + 1;
    message.reply(`⭐ Aapka current level hai **${level}** aur XP hai **${newXP}**.`);
  } else if (msgLower === "!rank") {
    let sorted = [...client.xp.entries()].sort((a, b) => b[1] - a[1]);
    let rank = sorted.findIndex(([id]) => id === userId) + 1;
    if (rank === 0) rank = "N/A";
    const level = Math.floor(newXP / 1000) + 1;
    message.reply(
      `🎖️ Aapka rank hai **${rank}** server me.\nLevel: **${level}**, XP: **${newXP}**`
    );
  } else if (msgLower === "!topxp") {
    let sorted = [...client.xp.entries()].sort((a, b) => b[1] - a[1]);
    let top10 = sorted.slice(0, 10);
    let description = "";
    for (let i = 0; i < top10.length; i++) {
      const [id, xp] = top10[i];
      const member = message.guild.members.cache.get(id);
      if (!member) continue;
      const level = Math.floor(xp / 1000) + 1;
      description += `**${i + 1}. ${member.user.username}** - Level: **${level}**, XP: **${xp}**\n`;
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

    const senderXP = client.xp.get(message.author.id) || 0;
    if (senderXP < amount) {
      return message.reply("❌ Aapke paas itni XP nahi hai!");
    }

    const receiverXP = client.xp.get(mention.id) || 0;

    client.xp.set(message.author.id, senderXP - amount);
    client.xp.set(mention.id, receiverXP + amount);

    message.channel.send(
      `✅ **${message.author.username}** ne **${mention.username}** ko **${amount} XP** transfer kiya!`
    );
  } else if (msgLower.includes("@sankhi")) {
    message.reply("Haan boliye! MR.SANKHI-BOTS yahan hai madad ke liye! 🤖");
  }
});

client.login(process.env.TOKEN);
