import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
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
  referral_code?: string;
  referred_by?: string;
  created_at?: string;
}

export function generateReferralCode(seed?: string): string {
  const prefix = (seed || 'BOOST').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'BST';
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${rand}`;
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
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        
        // Auto-generate referral code if missing or empty
        if (!userData.referral_code || userData.referral_code === '---') {
          const newCode = generateReferralCode(userData.username || uid);
          await updateDoc(userDocRef, { referral_code: newCode });
          userData.referral_code = newCode;
        }

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
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchUser(firebaseUser.uid);
        
        // Subscribe to real-time updates for the user profile
        unsubscribeSnapshot = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as User;
            setUser({ ...userData, id: firebaseUser.uid });
          } else {
            setUser(null);
          }
        }, (error) => {
           console.error("Error listening to user profile:", error);
        });
      } else {
        setUser(null);
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

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
