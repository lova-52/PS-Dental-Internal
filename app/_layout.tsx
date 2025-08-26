// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';

import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';


// Component nhỏ để chặn truy cập khi chưa đăng nhập
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const rawPathname = usePathname();

  useEffect(() => {
    // Nếu đang load trạng thái auth thì dừng, tránh điều hướng premature
    if (loading) return;

    // Normalize pathname: đảm bảo luôn có leading slash để startsWith ổn định
    const pathname = rawPathname ? (rawPathname.startsWith('/') ? rawPathname : '/' + rawPathname) : '/';

    const inAuth = pathname.startsWith('/(auth)');
    const inTabs = pathname.startsWith('/(tabs)');

    if (!user && inTabs) {
      // chưa đăng nhập mà vào tabs -> chuyển về login (dùng absolute path)
      router.replace('/(auth)/login');
    } else if (user && inAuth) {
      // đã đăng nhập mà còn ở login -> sang tabs
      router.replace('/(tabs)/add_customer');
    }
  }, [user, loading, rawPathname, router]);

  // Khi đang load, render null để tránh nháy màn hình / điều hướng sai
  if (loading) return null;

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthGate>
          <Stack>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="no-access" options={{ title: 'Không có quyền' }} />
          </Stack>
          <StatusBar style="auto" />
        </AuthGate>
      </ThemeProvider>
    </AuthProvider>
  );
}
