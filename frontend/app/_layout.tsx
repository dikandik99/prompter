import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/Toast";
import { AuthProvider } from "@/src/auth/AuthProvider";
import { I18nProvider } from "@/src/i18n";
import { queryClient } from "@/src/query-client";
import { LibraryProvider } from "@/src/store/library";
import { SettingsProvider } from "@/src/store/settings";

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <KeyboardProvider>
              <I18nProvider>
                <AuthProvider>
                  <SettingsProvider>
                    <LibraryProvider>
                      <ToastProvider>
                        <StatusBar style="light" />
                        <Stack
                          screenOptions={{
                            headerShown: false,
                            contentStyle: { backgroundColor: "#111111" },
                            animation: "slide_from_right",
                          }}
                        >
                          <Stack.Screen name="camera" options={{ animation: "fade" }} />
                          <Stack.Screen name="paywall" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
                          <Stack.Screen name="auth" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
                        </Stack>
                      </ToastProvider>
                    </LibraryProvider>
                  </SettingsProvider>
                </AuthProvider>
              </I18nProvider>
            </KeyboardProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
