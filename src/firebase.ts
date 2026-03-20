// Mock Firebase exports to allow build to pass
// Will be replaced with Neon PostgreSQL API calls

const mockAuth = {
  currentUser: null,
  onAuthStateChanged: (callback: any) => {
    callback(null);
    return () => {};
  },
  signInWithPopup: async () => ({ user: null }),
  signOut: async () => {},
  GoogleAuthProvider: class {}
};

export const db = {};
export const auth = mockAuth;

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

export const signInWithPopup = mockAuth.signInWithPopup;
export const GoogleAuthProvider = mockAuth.GoogleAuthProvider;
export const onAuthStateChanged = (callback: (user: null) => void) => {
  callback(null);
  return () => {};
};
export const signOut = mockAuth.signOut;