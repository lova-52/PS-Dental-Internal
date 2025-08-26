// app/index.tsx
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return; // chờ AuthProvider xác định trạng thái
    // nếu đã đăng nhập -> tabs (mặc định mở add_customer)
    if (user) {
      router.replace('/(auth)/login');
    } else {
      // nếu chưa -> chuyển tới login
      router.replace('/(auth)/login');
    }
  }, [user, loading]);

  // Hiển thị loading tạm thời khi đang xác thực
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
