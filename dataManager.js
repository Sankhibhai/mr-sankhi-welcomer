const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'data.json');

let data = {
  users: {},    // { userId: { xp: number, missionsCompleted: [], shopItems: [] } }
  missions: {}, // missionId: { description, xpReward, active }
  shopItems: {} // itemId: { name, description, priceXP }
};

// Load data from file
function loadData() {
  if (fs.existsSync(dataPath)) {
    const raw = fs.readFileSync(dataPath);
    data = JSON.parse(raw);
  }
}

// Save data to file
function saveData() {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

// Get or create user
function getUser(userId) {
  if (!data.users[userId]) {
    data.users[userId] = { xp: 0, missionsCompleted: [], shopItems: [] };
  }
  return data.users[userId];
}

// Add XP to a user
function addXP(userId, amount) {
  const user = getUser(userId);
  user.xp += amount;
  saveData();
}

// Complete a mission for a user
function completeMission(userId, missionId) {
  const user = getUser(userId);
  if (!user.missionsCompleted.includes(missionId)) {
    user.missionsCompleted.push(missionId);
    if (data.missions[missionId]) {
      addXP(userId, data.missions[missionId].xpReward || 0);
    }
    saveData();
    return true;
  }
  return false;
}

// Buy a shop item
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

// Initialize mission list
function initMissions(missionsList) {
  data.missions = {};
  for (const mission of missionsList) {
    data.missions[mission.id] = {
      description: mission.description,
      xpReward: mission.xpReward,
      active: mission.active !== false, // true by default
    };
  }
  saveData();
}

// Initialize shop items list
function initShopItems(shopList) {
  data.shopItems = {};
  for (const item of shopList) {
    data.shopItems[item.id] = {
      name: item.name,
      description: item.description,
      priceXP: item.price, // standard field
    };
  }
  saveData();
}

// Convert shopItems object to array for looping
function getShopItems() {
  return Object.entries(data.shopItems).map(([id, item]) => ({
    id,
    ...item,
  }));
}

// Return all users
function getAllUsers() {
  return data.users;
}

// Initial load
loadData();

// Export everything
module.exports = {
  getUser,
  addXP,
  completeMission,
  buyItem,
  initMissions,
  initShopItems,
  getShopItems,
  saveData,
  data,
  getAllUsers,
};
