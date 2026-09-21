// StacksContext — wallet connection state for the Sato dapp.
//
// Wraps @stacks/connect v8: `connect()` opens the wallet-select modal and
// returns addresses, `disconnect()` clears the session, and `getLocalStorage()`
// restores the address on reload. We expose the connected testnet STX address.

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  connect,
  disconnect as connectDisconnect,
  isConnected,
  getLocalStorage,
} from "@stacks/connect";

interface StacksContextType {
  address: string | null;
  isConnecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

const StacksContext = createContext<StacksContextType | undefined>(undefined);

// Pull the first STX address out of connect's local-storage shape.
function readStoredAddress(): string | null {
  try {
    const data = getLocalStorage();
    return data?.addresses?.stx?.[0]?.address ?? null;
  } catch {
    return null;
  }
}

export function StacksProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Restore a previous session on mount.
  useEffect(() => {
    if (isConnected()) {
      setAddress(readStoredAddress());
    }
  }, []);

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      const result = await connect();
      // connect() returns the address list; fall back to storage.
      const stx = result?.addresses?.find((a) => a.address?.startsWith("S"));
      setAddress(stx?.address ?? readStoredAddress());
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    connectDisconnect();
    setAddress(null);
  };

  return (
    <StacksContext.Provider
      value={{ address, isConnecting, connectWallet, disconnectWallet }}
    >
      {children}
    </StacksContext.Provider>
  );
}

export function useStacks() {
  const context = useContext(StacksContext);
  if (!context) {
    throw new Error("useStacks must be used within StacksProvider");
  }
  return context;
}
