// app/(tabs)/_layout.tsx
import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { FontAwesome } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, hasRole, can } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // nếu user có role photographer -> chuyển thẳng tới page no-access (absolute path)
    if (user?.roles?.includes('photographer')) {
      router.replace('/no-access');
    }
  }, [user, router]);

  // Quy ước hiển thị:
  const showSearch = can('customer.add');      // telesale, admin
  const showAddCustomer = can('customer.add'); // telesale, assistant, admin
  const showAppt = can('appt.view');           // telesale, assistant, admin

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            height: 64,
            paddingTop: 6,
            paddingBottom: 12,
          },
          default: {
            height: 56,
            paddingBottom: 6,
          },
        }),
      }}
    >
      {showSearch && (
        <Tabs.Screen
          name="search_customer"
          options={{
            title: 'Khách hàng',
            tabBarIcon: ({ color }) => <FontAwesome size={24} name="search" color={color} />,
          }}
        />
      )}

      {showAddCustomer && (
        <Tabs.Screen
          name="add_customer"
          options={{
            title: 'Thêm khách hàng',
            tabBarIcon: ({ color }) => <FontAwesome size={24} name="user-plus" color={color} />,
          }}
        />
      )}

      {showAppt && (
        <Tabs.Screen
          name="manage_appointment"
          options={{
            title: 'Lịch hẹn',
            tabBarIcon: ({ color }) => <FontAwesome size={24} name="calendar" color={color} />,
          }}
        />
      )}
    </Tabs>
  );
}
