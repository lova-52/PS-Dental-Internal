// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';

export default function AuthStack() {
  return (
    <Stack>
      <Stack.Screen name="login" options={{ headerShown: false }} />
    </Stack>
  );
}
