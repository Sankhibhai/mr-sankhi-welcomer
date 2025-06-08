client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const userData = dataManager.getUser(userId) || {};
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

    const targetData = dataManager.getUser(targetUser.id) || {};
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

  // === Added XP commands start ===

  if (msgLower === "!xp") {
    const xp = userData.xp || 0;
    const level = Math.floor(xp / 1000);
    return message.reply(`🔹 XP: **${xp}** | Level: **${level}**`);
  }

  if (msgLower.startsWith("!giftxp")) {
    const targetUser = message.mentions.users.first();
    const amount = parseInt(args[2]);

    if (!targetUser || isNaN(amount) || amount <= 0) {
      return message.reply("❌ Usage: `!giftxp @user amount`");
    }

    if (userId === targetUser.id) {
      return message.reply("❌ Aap khud ko XP gift nahi kar sakte!");
    }

    const userXP = userData.xp || 0;
    if (userXP < amount) {
      return message.reply("❌ Aapke paas itni XP nahi hai!");
    }

    const targetData = dataManager.getUser(targetUser.id) || {};
    userData.xp -= amount;
    targetData.xp = (targetData.xp || 0) + amount;
    dataManager.saveData();

    return message.channel.send(`🎁 ${message.author.username} ne **${targetUser.username}** ko **${amount} XP** gift kiya!`);
  }

  if (msgLower === "!topxp") {
    const allData = dataManager.getAllUsers(); // tumhe ye function banana hoga
    const sorted = Object.entries(allData)
      .sort(([, a], [, b]) => (b.xp || 0) - (a.xp || 0))
      .slice(0, 10);

    const leaderboard = await Promise.all(
      sorted.map(async ([id, data], i) => {
        const user = await client.users.fetch(id).catch(() => null);
        const name = user ? user.username : "Unknown User";
        const xp = data.xp || 0;
        return `**#${i + 1}** – ${name}: **${xp} XP**`;
      })
    );

    return message.channel.send("🏆 **Top XP Holders**\n" + leaderboard.join("\n"));
  }

  // === Added XP commands end ===

  // Add random XP for every message (already in your code)
  const randomXP = Math.floor(Math.random() * 6) + 5;
  dataManager.addXP(userId, randomXP);
});
