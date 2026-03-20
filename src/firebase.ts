// Mock Firebase exports to allow build to pass
// Will be replaced with Neon PostgreSQL API calls
export const db = {};
export const auth = {
  currentUser: null
};

export const collection = () => null;
export const onSnapshot = () => () => {};
export const addDoc = async () => ({ id: 'mock' });
export const updateDoc = async () => {};
export const deleteDoc = async () => {};
export const getDocs = async () => ({ docs: [] });
export const doc = () => 'mock-doc';
export const query = () => null;
export const where = () => null;
export const getDocFromServer = async () => ({});
export const Timestamp = { now: () => ({ toDate: () => new Date() }) };
export const writeBatch = () => ({ set: () => {}, update: () => {}, delete: () => {}, commit: async () => {} });

export const signInWithPopup = async () => ({ user: null });
export const GoogleAuthProvider = class {};
export const onAuthStateChanged = () => () => {};
export const signOut = async () => {};