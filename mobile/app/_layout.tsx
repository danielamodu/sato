// Root layout: providers that wrap every screen. SafeAreaProvider for insets,
// WalletProvider so any screen can read on-chain state + fire gasless actions
// (and so the toast host renders above everything). The (tabs) group is the
// main app; `account` is a modal presented over it.

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { WalletProvider } from "@/state/wallet-store";
import { C } from "@/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <WalletProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: C.paper },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="account"
            options={{
              presentation: "modal",
              headerShown: true,
              title: "Account",
              headerStyle: { backgroundColor: C.paper },
              headerShadowVisible: false,
              headerTintColor: C.ink,
            }}
          />
        </Stack>
      </WalletProvider>
    </SafeAreaProvider>
  );
}
