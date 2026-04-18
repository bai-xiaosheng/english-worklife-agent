const profileStore = new Map();
const sessionStore = new Map();
const progressStore = new Map();

export function saveProfile(userId, profile) {
  profileStore.set(userId, { ...profile, userId, updatedAt: new Date().toISOString() });
}

export function getProfile(userId) {
  return profileStore.get(userId);
}

export function upsertSession(userId, session) {
  sessionStore.set(userId, session);
}

export function getSession(userId) {
  return sessionStore.get(userId);
}

export function pushPracticeRecord(userId, record) {
  const records = progressStore.get(userId) || [];
  records.push(record);
  progressStore.set(userId, records);
}

export function getPracticeRecords(userId) {
  return progressStore.get(userId) || [];
}

