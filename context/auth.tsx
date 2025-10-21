import { auth } from '@/config/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { createUserProfile, getUser } from '@/services/users';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);

      // Auto-create user profile if it doesn't exist
      // MANUAL: This requires the Firestore security rules to be deployed
      // The rules must allow users to create their own user documents
      if (user) {
        try {
          const userProfile = await getUser(user.uid);

          if (!userProfile) {
            // User profile doesn't exist, create it
            console.log('Creating user profile for:', user.email);
            await createUserProfile(
              user.uid,
              user.email || 'unknown@example.com',
              user.displayName || undefined
            );
            console.log('User profile created successfully');
          }
        } catch (error) {
          console.error('Error checking/creating user profile:', error);
          // Don't block login if user profile creation fails
        }
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
