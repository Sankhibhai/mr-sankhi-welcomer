module.exports = async (client) => {
  const fetchGuildInvites = async (guild) => {
    const invites = await guild.invites.fetch();
    const codeUses = new Map();
    invites.each(invite => codeUses.set(invite.code, invite.uses));
    return codeUses;
  };

  client.on("ready", async () => {
    client.guilds.cache.forEach(async guild => {
      client.invites.set(guild.id, await fetchGuildInvites(guild));
    });
  });

  client.on("inviteCreate", async (invite) => {
    const invites = await invite.guild.invites.fetch();
    const codeUses = new Map();
    invites.each(inv => codeUses.set(inv.code, inv.uses));
    client.invites.set(invite.guild.id, codeUses);
  });

  client.on("guildMemberAdd", async (member) => {
    const cachedInvites = client.invites.get(member.guild.id);
    const newInvites = await member.guild.invites.fetch();
    client.invites.set(member.guild.id, new Map(newInvites.map(inv => [inv.code, inv.uses])));

    const invite = newInvites.find(i => cachedInvites.get(i.code) < i.uses);
    if (invite) {
      const inviter = invite.inviter;
      const used = client.invites.get(member.guild.id) || new Map();
      used.set(member.id, { user: inviter });
      client.invites.set(member.guild.id, used);
    }
  });
};
