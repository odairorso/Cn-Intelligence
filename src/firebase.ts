import { api, Transaction, Supplier } from './api';

const DEFAULT_UID = 'demo-user-001';

const createMockDoc = (data: any, id: string) => ({
  id,
  data: () => data,
  ...data
});

const mockAuth = {
  currentUser: { uid: DEFAULT_UID, email: 'demo@cnintelligence.com' },
  onAuthStateChanged: (callback: any) => {
    callback(mockAuth.currentUser);
    return () => {};
  },
  signInWithPopup: async () => ({ user: mockAuth.currentUser }),
  signOut: async () => {},
  GoogleAuthProvider: class {}
};

let transactionsCache: Transaction[] = [];
let suppliersCache: Supplier[] = [];
let listeners: Array<() => void> = [];

function notifyListeners() {
  listeners.forEach(fn => fn());
}

export const db = {};

export const auth = mockAuth;

export const collection = (db: any, name: string) => name;

export const onSnapshot = (query: any, callback: (snapshot: { docs: any[] }) => void) => {
  const update = async () => {
    if (query === 'transactions') {
      transactionsCache = await api.getTransactions(DEFAULT_UID);
    } else if (query === 'suppliers') {
      suppliersCache = await api.getSuppliers(DEFAULT_UID);
    }
    callback({
      docs: (query === 'transactions' ? transactionsCache : suppliersCache).map((item, i) => 
        createMockDoc(item, item.id || `mock-${i}`)
      )
    });
  };
  
  update();
  
  const listener = () => {};
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
};

export const getDocs = async (query: any) => {
  if (query === 'transactions') {
    const data = await api.getTransactions(DEFAULT_UID);
    return {
      docs: data.map((item, i) => createMockDoc(item, item.id || `mock-${i}`))
    };
  } else if (query === 'suppliers') {
    const data = await api.getSuppliers(DEFAULT_UID);
    return {
      docs: data.map((item, i) => createMockDoc(item, item.id || `mock-${i}`))
    };
  }
  return { docs: [] };
};

export const addDoc = async (collection: string, data: any) => {
  if (collection === 'transactions') {
    const result = await api.createTransaction({ ...data, uid: DEFAULT_UID });
    notifyListeners();
    return { id: result.id };
  } else if (collection === 'suppliers') {
    const result = await api.createSupplier({ ...data, uid: DEFAULT_UID });
    notifyListeners();
    return { id: result.id };
  }
  return { id: 'mock' };
};

export const updateDoc = async (docRef: any, data: any) => {
  if (docRef?.id) {
    await api.updateTransaction(docRef.id, data);
    notifyListeners();
  }
};

export const deleteDoc = async (docRef: any) => {
  if (docRef?.id) {
    await api.deleteTransaction(docRef.id);
    notifyListeners();
  }
};

export const doc = (db: any, collection: string, id: string) => ({ id, collection });

export const query = (collection: any, ...args: any[]) => collection;

export const where = () => null;

export const getDocFromServer = async (docRef: any) => docRef;

export const Timestamp = { 
  now: () => ({ 
    toDate: () => new Date(),
    toMillis: () => Date.now()
  }) 
};

export const writeBatch = () => ({ 
  set: () => {}, 
  update: () => {}, 
  delete: () => {}, 
  commit: async () => {} 
});

export const signInWithPopup = mockAuth.signInWithPopup;
export const GoogleAuthProvider = mockAuth.GoogleAuthProvider;
export const onAuthStateChanged = mockAuth.onAuthStateChanged;
export const signOut = mockAuth.signOut;

export const DEFAULT_USER_UID = DEFAULT_UID;