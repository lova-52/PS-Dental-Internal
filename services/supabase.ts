// services/supabase.ts
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto'; // ensure URL global for RN

// Thay các giá trị bằng biến môi trường an toàn trong production
const SUPABASE_URL = 'https://eunhyooeamidnybprxdv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1bmh5b29lYW1pZG55YnByeGR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4MzcxNDIsImV4cCI6MjA3MTQxMzE0Mn0.0Y5SUXTMU29QOZYhzB9zzHwHPNeh7gtT6znnmHVN2Zk';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  // Optionally set global fetch (React Native supports fetch)
  auth: {
    persistSession: false,
  },
});
