"use client";
import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { del } from 'idb-keyval';

export interface User {
  id: string;
  email?: string;
  app_metadata: any;
  user_metadata: any;
  aud: string;
  created_at: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
  user: User;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const performSignOut = async () => {
  try {
    await del('coral-database-storage-v4');
    localStorage.removeItem('coral-schema-version');
  } catch {
    /* cache wipe is best-effort; sign-out must still proceed */
  }
  await nextAuthSignOut({ callbackUrl: '/login' });
};

const notImplementedSignIn = async () => {
  throw new Error('signIn is not implemented in workhub AuthContext; use next-auth signIn');
};

const notImplementedSignUp = async () => {
  throw new Error('signUp is not implemented in workhub AuthContext');
};

const mockAuthContext: AuthContextType = {
  user: null,
  session: null,
  profile: null,
  loading: true,
  signIn: notImplementedSignIn,
  signUp: notImplementedSignUp,
  signOut: performSignOut,
  resetPassword: async () => ({ error: new Error('User is not authenticated') }),
};

const AuthContext = createContext<AuthContextType>(mockAuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: nextSession, status } = useSession();

  const authValue = useMemo(() => {
    if (status === 'loading') return mockAuthContext;

    if (!nextSession?.user) {
      return {
        ...mockAuthContext,
        loading: false,
      };
    }

    // Bridge NextAuth session into legacy shape for the TimeTracker
    const bridgedUser: User = {
      id: nextSession.user.id,
      email: nextSession.user.email || undefined,
      app_metadata: {},
      user_metadata: { tenantId: (nextSession.user as any).tenantId },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };

    const bridgedProfile: Profile = {
      id: nextSession.user.id,
      user_id: nextSession.user.id,
      full_name: nextSession.user.name || 'User',
    };

    const bridgedSession: Session = {
      access_token: 'bridged-token',
      refresh_token: 'bridged-token',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: bridgedUser,
    };

    return {
      user: bridgedUser,
      session: bridgedSession,
      profile: bridgedProfile,
      loading: false,
      signIn: notImplementedSignIn,
      signUp: notImplementedSignUp,
      signOut: performSignOut,
      resetPassword: async (email: string) => {
        const targetEmail = (email || nextSession.user?.email || '').trim().toLowerCase();
        if (!targetEmail) {
          return { error: new Error('Email is required for password reset') };
        }
        try {
          const res = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: targetEmail }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            return { error: new Error(body?.error || 'Failed to send password reset email') };
          }
          return { error: null };
        } catch (err: any) {
          return { error: err instanceof Error ? err : new Error(String(err)) };
        }
      },
    };
  }, [nextSession, status]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
