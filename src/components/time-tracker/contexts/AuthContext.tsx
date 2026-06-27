"use client";
import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useSession } from 'next-auth/react';

export interface User {
  id: string;
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

const mockAuthContext: AuthContextType = {
  user: null,
  session: null,
  profile: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => { },
  resetPassword: async () => ({ error: null }),
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

    // Bridge NextAuth session into Supabase-like shape for the TimeTracker
    const bridgedUser = {
      id: nextSession.user.id,
      app_metadata: {},
      user_metadata: { tenantId: (nextSession.user as any).tenantId },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as User;

    const bridgedProfile: Profile = {
      id: nextSession.user.id,
      user_id: nextSession.user.id,
      full_name: nextSession.user.name || 'User',
    };

    const bridgedSession = {
      access_token: 'bridged-token',
      refresh_token: 'bridged-token',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: bridgedUser,
    } as Session;

    return {
      user: bridgedUser,
      session: bridgedSession,
      profile: bridgedProfile,
      loading: false,
      signIn: async () => ({ error: null }),
      signUp: async () => ({ error: null }),
      signOut: async () => { },
      resetPassword: async () => ({ error: null }),
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
