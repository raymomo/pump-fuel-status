import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  get: async (key) => {
    try {
      const val = await AsyncStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch { return null; }
  },

  set: async (key, value) => {
    try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch {}
  },

  remove: async (key) => {
    try { await AsyncStorage.removeItem(key); } catch {}
  },
};
