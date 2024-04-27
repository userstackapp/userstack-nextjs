'use client';

import React, { createContext, useContext, useEffect, Suspense } from 'react';
import { usePathname, useSearchParams, useParams } from 'next/navigation';

const DEFAULT_API_URL = 'https://userstack.app/api/edge';
const JWT_STORAGE_KEY = 'us-jwt';

interface UserstackProviderProps {
  children: React.ReactNode;
  projectKey: string;
  customApiUrl?: string;
  debugMode?: boolean;
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
  debugMode = false,
}) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();

  const log = {
    normal: (...args: any[]) => {
      if (debugMode) {
        console.log('[Userstack]', ...args);
      }
    },
    error: (...args: any[]) => {
      if (debugMode) {
        console.error('[Userstack]', ...args);
      }
    },
  };

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
      log.normal('Successfully identified user.');
      track('app', 'signin');
    } else {
      const responseText = await response.text();
      log.error('Failed to identify user:', responseText);
      throw new Error(responseText);
    }
  };

  const forget = (): void => {
    storage.delete(JWT_STORAGE_KEY);
    log.normal('Session ended');
  };

  const track = async (feature: string, event?: string, data?: any) => {
    log.normal('Track event:', feature, event, data);
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
      log.error('Error tracking event: No token');
    }
  };

  useEffect(() => {
    const currentUrlParams = searchParams.toString();
    const jsonParams = getJsonFromUrl(currentUrlParams);

    track('app', 'pageview', {
      path: pathname,
      params: params,
      searchParams: jsonParams,
      route: formRouteString(pathname, params),
    });
  }, [pathname, params, searchParams]);

  function getJsonFromUrl(url: string) {
    const queryParams = new URLSearchParams(url);
    let jsonObj: any = {};
    queryParams.forEach((value, key) => {
      if (jsonObj.hasOwnProperty(key)) {
        if (!Array.isArray(jsonObj[key])) {
          jsonObj[key] = [jsonObj[key]];
        }
        jsonObj[key].push(value);
      } else {
        jsonObj[key] = value;
      }
    });

    return jsonObj;
  }

  const formRouteString = (path: string, params: any) => {
    if (!params) return path;

    let newPath = path;
    Object.keys(params).forEach((key) => {
      newPath = newPath.replace(`${params[key]}`, `[${key}]`);
    });
    return newPath;
  };

  return (
    <Suspense>
      <UserstackContext.Provider
        value={{
          identify,
          forget,
          track,
        }}
      >
        {children}
      </UserstackContext.Provider>
    </Suspense>
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
