// app/no-access.tsx
import { useAuth } from '@/context/AuthContext';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function NoAccess() {
  const { logout } = useAuth();
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Bạn không có quyền truy cập ứng dụng này.</Text>
      <Text style={styles.sub}>Vui lòng liên hệ Admin để cấp quyền phù hợp.</Text>
      <TouchableOpacity onPress={logout} style={styles.btn}><Text style={{color:'#fff', fontWeight:'700'}}>Đăng xuất</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex:1, alignItems:'center', justifyContent:'center', padding:20 },
  title: { fontSize:18, fontWeight:'700', textAlign:'center', marginBottom:8 },
  sub: { color:'#6b7280', textAlign:'center', marginBottom:16 },
  btn: { backgroundColor:'#ef4444', padding:12, borderRadius:10 }
});
