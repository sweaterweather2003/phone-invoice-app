import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth, getDb as getDbInstance } from '../firebase';
import { createCompany } from '../db/firebaseDb';

interface AuthUser {
  id: string;
  email: string;
  companyName?: string | null;
  createdAt?: string;
}

interface AuthState {
  loading: boolean;
  user: AuthUser | null;
  companyName: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, companyName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function getUserProfile(uid: string): Promise<AuthUser | null> {
  const db = getDbInstance();
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;

  const data = snap.data() as Record<string, any>;
  return {
    id: uid,
    email: data.email ?? '',
    companyName: data.companyName ?? null,
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        if (active) {
          setUser(null);
          setCompanyName(null);
          setLoading(false);
        }
        return;
      }

      const profile = (await getUserProfile(firebaseUser.uid)) ?? {
        id: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        companyName: null,
        createdAt: new Date().toISOString(),
      };

      if (active) {
        setUser(profile);
        setCompanyName(profile.companyName ?? null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const register = async (email: string, password: string, companyNameValue: string) => {
    const trimmedCompanyName = companyNameValue.trim();
    if (!trimmedCompanyName) throw new Error('Brand name is required');

    const auth = await getAuth();
    const db = getDbInstance();
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const now = new Date().toISOString();
    const profile: AuthUser = {
      id: credential.user.uid,
      email: credential.user.email ?? email.trim(),
      companyName: trimmedCompanyName,
      createdAt: now,
    };

    await setDoc(doc(db, 'users', credential.user.uid), {
      ...profile,
      email: profile.email.toLowerCase(),
      companyName: trimmedCompanyName,
      createdAt: now,
    });

    await createCompany({ name: trimmedCompanyName });

    setUser(profile);
    setCompanyName(trimmedCompanyName);
  };

  const login = async (email: string, password: string) => {
    const auth = await getAuth();
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const profile = (await getUserProfile(credential.user.uid)) ?? {
      id: credential.user.uid,
      email: credential.user.email ?? email.trim(),
      companyName: null,
      createdAt: new Date().toISOString(),
    };

    setUser(profile);
    setCompanyName(profile.companyName ?? null);
  };

  const logout = async () => {
    const auth = await getAuth();
    await signOut(auth);
    setUser(null);
    setCompanyName(null);
  };

  return (
    <AuthContext.Provider value={{ loading, user, companyName, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}