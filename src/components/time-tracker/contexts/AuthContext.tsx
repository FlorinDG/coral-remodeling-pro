"use client";
import { createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';

// We intentionally mock this profile to allow the TimeTracker UI to render
// Since this is embedded in an Admin Dashboard protected by NextAuth,
// we just need the TimeTracker module to think a user is logged in.
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

const mockUser: User = {
  id: '00000000-0000-0000-0000-000000000000',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
};

const mockProfile: Profile = {
  id: '00000000-0000-0000-0000-000000000000',
  user_id: '00000000-0000-0000-0000-000000000000',
  full_name: 'Admin User',
};

const mockSession: Session = {
  access_token: 'mock-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: mockUser,
};

const mockAuthContext: AuthContextType = {
  user: mockUser,
  session: mockSession,
  profile: mockProfile,
  loading: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => { },
  resetPassword: async () => ({ error: null }),
};

const AuthContext = createContext<AuthContextType>(mockAuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Pass the mocked context down to bypass Supabase login UI
  return (
    <AuthContext.Provider value={mockAuthContext}>
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

