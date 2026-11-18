import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  nationality: string | null;
  travelStyle: string | null;
  preferredCurrency: string | null;
  travelHistory: string[];
}

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  roles: string[];
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  apiFetch: <T>(url: string, options?: RequestInit) => Promise<T>;
  isAdmin: boolean;
  isProvider: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const syncWithBackend = useCallback(async (user: User | null) => {
    if (!user) {
      setIdToken(null);
      setProfile(null);
      setRoles([]);
      setLoading(false);
      return;
    }

    try {
      const token = await user.getIdToken();
      setIdToken(token);
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error('Failed to verify session with server');
      }
      const data = (await res.json()) as { profile: UserProfile; roles: string[] };
      setProfile(data.profile);
      setRoles(data.roles);
      setAuthError(null);
    } catch (err) {
      console.error('Auth sync error:', err);
      setAuthError(err instanceof Error ? err.message : 'Authentication sync failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      void syncWithBackend(user);
    });
    return () => unsubscribe();
  }, [syncWithBackend]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      await syncWithBackend(cred.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed';
      setAuthError(message);
      throw err;
    }
  }, [syncWithBackend]);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setFirebaseUser(null);
    setIdToken(null);
    setProfile(null);
    setRoles([]);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (firebaseUser) {
      await syncWithBackend(firebaseUser);
    }
  }, [firebaseUser, syncWithBackend]);

  const apiFetch = useCallback(
    async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
      let token = idToken;
      if (firebaseUser) {
        token = await firebaseUser.getIdToken();
      }
      const headers = new Headers(options.headers || {});
      if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
      }
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const response = await fetch(url, { ...options, headers });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Request failed (${response.status})`);
      }
      return payload as T;
    },
    [firebaseUser, idToken]
  );

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        roles,
        loading,
        authError,
        signInWithGoogle,
        signOut,
        refreshProfile,
        apiFetch,
        isAdmin: roles.includes('admin'),
        isProvider: roles.includes('provider'),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
