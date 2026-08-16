import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface User {
  id: string; // Firebase UID
  username: string;
  email?: string;
  role: string;
  is_verified: boolean;
  is_blocked: boolean;
  credits: number;
  tickets: number;
  plan_type?: string;
  plan_expires_at?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        setUser({ ...userData, id: uid });
        localStorage.setItem('has_account', 'true');
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Error fetching user data from Firestore:", err);
      setUser(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchUser(firebaseUser.uid);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Update loop for specific real-time needs (if necessary, later we can use onSnapshot)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => fetchUser(user.id), 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser: async () => { if (auth.currentUser) await fetchUser(auth.currentUser.uid); }, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
