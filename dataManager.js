// dataManager.js
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
    addXP(userId, data.missions[missionId].xpReward);
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
  data.missions = missionsList;
  saveData();
}

function initShopItems(shopList) {
  data.shopItems = shopList;
  saveData();
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
  data, // expose data for read-only use
};
