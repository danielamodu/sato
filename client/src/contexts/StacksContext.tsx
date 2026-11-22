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

interface StacksContextType {
  address: string | null;
  isConnecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

const StacksContext = createContext<StacksContextType | undefined>(undefined);

let connectModPromise: Promise<typeof import("@stacks/connect")> | null = null;
function loadConnect() {
  if (!connectModPromise) {
    connectModPromise = import("@stacks/connect");
  }
  return connectModPromise;
}

export function StacksProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Restore a previous session after initial paint without blocking first render.
  useEffect(() => {
    let alive = true;
    try {
      if (typeof localStorage === "undefined" || localStorage.length === 0) {
        return;
      }
    } catch {
      return;
    }
    loadConnect()
      .then(({ isConnected, getLocalStorage }) => {
        if (!alive || !isConnected()) return;
        const data = getLocalStorage();
        setAddress(data?.addresses?.stx?.[0]?.address ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      const { connect, getLocalStorage } = await loadConnect();
      const result = await connect();
      // connect() returns the address list; fall back to storage.
      const stx = result?.addresses?.find((a) => a.address?.startsWith("S"));
      setAddress(stx?.address ?? getLocalStorage()?.addresses?.stx?.[0]?.address ?? null);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    loadConnect()
      .then(({ disconnect }) => disconnect())
      .catch(() => {});
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
