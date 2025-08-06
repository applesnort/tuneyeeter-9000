"use client";

import { useEffect, useState, createContext, useContext } from "react";
import Script from "next/script";
import { musicKit } from "@/lib/musickit-client";
import toast from "react-hot-toast";

interface MusicKitContextType {
  isLoaded: boolean;
  isAuthorized: boolean;
  authorize: () => Promise<void>;
  unauthorize: () => Promise<void>;
}

const MusicKitContext = createContext<MusicKitContextType>({
  isLoaded: false,
  isAuthorized: false,
  authorize: async () => {},
  unauthorize: async () => {},
});

export const useMusicKit = () => useContext(MusicKitContext);

interface MusicKitProviderProps {
  children: React.ReactNode;
  developerToken?: string;
}

export function MusicKitProvider({ children, developerToken }: MusicKitProviderProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (isLoaded && developerToken) {
      musicKit.configure(developerToken).catch(error => {
        console.error('Failed to configure MusicKit:', error);
        toast.error('Failed to initialize Apple Music');
      });
    }
  }, [isLoaded, developerToken]);

  const authorize = async () => {
    try {
      const token = await musicKit.authorize();
      if (token) {
        setIsAuthorized(true);
        toast.success('Connected to Apple Music!');
      } else {
        toast.error('Apple Music authorization cancelled');
      }
    } catch (error) {
      console.error('Authorization error:', error);
      toast.error('Failed to connect to Apple Music');
    }
  };

  const unauthorize = async () => {
    try {
      await musicKit.unauthorize();
      setIsAuthorized(false);
      toast.success('Disconnected from Apple Music');
    } catch (error) {
      console.error('Unauthorize error:', error);
    }
  };

  return (
    <>
      <Script
        src="https://js-cdn.music.apple.com/musickit/v3/musickit.js"
        onLoad={() => {
          console.log('MusicKit JS loaded');
          setIsLoaded(true);
        }}
        onError={(e) => {
          console.error('Failed to load MusicKit JS:', e);
          toast.error('Failed to load Apple Music SDK');
        }}
      />
      <MusicKitContext.Provider value={{ isLoaded, isAuthorized, authorize, unauthorize }}>
        {children}
      </MusicKitContext.Provider>
    </>
  );
}