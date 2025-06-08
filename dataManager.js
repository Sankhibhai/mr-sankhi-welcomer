const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'data.json');

let data = {
  users: {},    // { userId: { xp: number, missionsCompleted: [], shopItems: [] } }
  missions: {}, // missionId: { description, xpReward, active }
  shopItems: {} // itemId: { name, description, priceXP }
};

function loadData() {
  if (fs.existsSync(dataPath)) {
    const raw = fs.readFileSync(dataPath);
    data = JSON.parse(raw);
  }
}

function saveData() {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function getUser(userId) {
  if (!data.users[userId]) {
    data.users[userId] = { xp: 0, missionsCompleted: [], shopItems: [] };
  }
  return data.users[userId];
}

function addXP(userId, amount) {
  const user = getUser(userId);
  user.xp += amount;
  saveData();
}

function completeMission(userId, missionId) {
  const user = getUser(userId);
  if (!user.missionsCompleted.includes(missionId)) {
    user.missionsCompleted.push(missionId);
    if(data.missions[missionId]) {
      addXP(userId, data.missions[missionId].xpReward || 0);
    }
    saveData();
    return true;
  }
  return false;
}

function buyItem(userId, itemId) {
  const user = getUser(userId);
  const item = data.shopItems[itemId];
  if (!item) return { success: false, reason: 'Invalid item.' };
  if (user.xp < item.priceXP) return { success: false, reason: 'Not enough XP.' };
  if (user.shopItems.includes(itemId)) return { success: false, reason: 'Already owned.' };

  user.xp -= item.priceXP;
  user.shopItems.push(itemId);
  saveData();
  return { success: true };
}

function initMissions(missionsList) {
  data.missions = {};
  for (const mission of missionsList) {
    data.missions[mission.id] = {
      description: mission.description,
      xpReward: mission.xpReward,
      active: mission.active || true,
    };
  }
  saveData();
}

function initShopItems(shopList) {
  data.shopItems = {};
  for (const item of shopList) {
    data.shopItems[item.id] = {
      name: item.name,
      description: item.description,
      priceXP: item.price, // consistent naming
    };
  }
  saveData();
}

function getAllUsers() {
  return data.users;
}

loadData();

module.exports = {
  getUser,
  addXP,
  completeMission,
  buyItem,
  initMissions,
  initShopItems,
  saveData,
  data,
  getAllUsers,
};
