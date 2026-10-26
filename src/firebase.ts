import { getApp, getApps, initializeApp } from 'firebase/app';
// Firebase 10.14.1 supplies these exports through Metro's React Native bundle.
import {
  initializeAuth,
  getAuth as fbGetAuth,
  // @ts-ignore The package declaration omits this conditional RN export.
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyAnI1JYVdCbbIchctjyOgNh-B7BC1Iluds',
  authDomain: 'financeinvoicing-d2489.firebaseapp.com',
  projectId: 'financeinvoicing-d2489',
  storageBucket: 'financeinvoicing-d2489.firebasestorage.app',
  messagingSenderId: '232583282576',
  appId: '1:232583282576:web:dc5d29a55483aa4d09fd15',
  measurementId: 'G-W59V5YZ407',
};

// Initialize Firebase App instance
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Web uses Firebase's browser persistence; native uses AsyncStorage.
let authInstance: Auth;
if (Platform.OS === 'web') {
  authInstance = fbGetAuth(app);
} else {
  try {
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error: any) {
    // Fast Refresh can preserve an already initialized Auth instance.
    if (error?.code !== 'auth/already-initialized') throw error;
    authInstance = fbGetAuth(app);
  }
}

// Synchronous getters to prevent runtime lifecycle errors
export const getAuth = (): Auth => authInstance;
export const getAuthSync = (): Auth => authInstance;
export const auth = authInstance;
// Initialize and export Firestore instance synchronously
const dbInstance: Firestore = getFirestore(app);
export const getDb = (): Firestore => dbInstance;
export const db = dbInstance;

export { app };