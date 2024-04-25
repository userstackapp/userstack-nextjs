import React, { createContext, useContext, useEffect } from 'react';

const DEFAULT_API_URL = 'https://userstack.app/api/edge';
const JWT_STORAGE_KEY = 'us-jwt';

interface UserstackProviderProps {
  children: React.ReactNode;
  projectKey: string;
  customApiUrl?: string;
}

interface IdentifyProps {
  googleToken?: string;
  firebaseToken?: string;
  userId?: string;
  name?: string;
  email?: string;
  picture?: string;
  data?: any;
}

type UserstackContextType = {
  identify: (id: IdentifyProps) => Promise<void>;
  forget: () => void;
  track: (feature: string, event?: string, data?: any) => void;
};

const UserstackContext = createContext<UserstackContextType>(
  {} as UserstackContextType,
);

export const UserstackProvider: React.FC<UserstackProviderProps> = ({
  children,
  projectKey,
  customApiUrl = DEFAULT_API_URL,
}) => {
  const identify = async ({
    googleToken,
    firebaseToken,
    userId,
    name,
    email,
    picture,
    data,
  }: IdentifyProps): Promise<void> => {
    const response = await fetch(`${customApiUrl}/identify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-userstack-project-key': projectKey,
      },
      body: JSON.stringify({
        googleToken,
        firebaseToken,
        userId,
        email,
        name,
        picture,
        data,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const { jwt, expiresIn } = data;
      storage.set(JWT_STORAGE_KEY, jwt);
      console.log('[Userstack] successfully identified user.');
      track('app', 'signin');
    } else {
      const responseText = await response.text();
      console.error('[Userstack] failed to identify user:', responseText);
      throw new Error(responseText);
    }
  };

  const forget = (): void => {
    storage.delete(JWT_STORAGE_KEY);
    console.log('[Userstack] Session ended');
  };

  const track = async (feature: string, event?: string, data?: any) => {
    const jwt = storage.get(JWT_STORAGE_KEY);

    if (jwt) {
      await fetch(`${customApiUrl}/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
          'x-userstack-project-key': projectKey,
        },
        body: JSON.stringify({
          feature,
          event,
          data,
        }),
      });
    } else {
      console.error('[Userstack] Error tracking event: No token');
    }
  };

  useEffect(() => {
    track('app', 'pageview', {
      location: window.location.href,
    });
  }, []);

  return (
    <UserstackContext.Provider
      value={{
        identify,
        forget,
        track,
      }}
    >
      {children}
    </UserstackContext.Provider>
  );
};

export const useUserstack = (): UserstackContextType => {
  const context = useContext(UserstackContext);
  if (context === undefined) {
    throw new Error('useUserstack must be used within a UserstackProvider');
  }
  return context;
};

export default useUserstack;

// storage helper

const storage = {
  set: (key: string, value: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  },
  get: (key: string) => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
  },
  delete: (key: string) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  },
};
