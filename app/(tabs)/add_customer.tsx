// app/(tabs)/add_customer.tsx
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/services/api';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/services/supabase';
import { decode as base64ToArrayBuffer } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { v4 as uuidv4 } from 'uuid';

const SERVICES = ['Thăm khám', 'Implant', 'Niềng răng', 'Bọc răng sứ'];

export default function AddCustomer() {
  const { can } = useAuth();
  const canAdd = can('customer.add');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [service, setService] = useState('');
  const [avatar, setAvatar] = useState(''); // public URL from supabase
  const [nasLink, setNasLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [servicePickerVisible, setServicePickerVisible] = useState(false);

  // pick image then upload (base64 -> ArrayBuffer)
  const pickAndUpload = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Quyền bị từ chối', 'Vui lòng cho phép truy cập ảnh để upload.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // recommended constant
        allowsEditing: true,
        quality: 0.8,
        aspect: [1, 1],
      });

      // expo-image-picker v14+ trả về object with `canceled` + `assets`
      if ((res as any).canceled) return;

      const assets = (res as any).assets;
      const uri = assets && assets.length ? assets[0].uri : undefined;
      if (!uri) {
        Alert.alert('Lỗi', 'Không lấy được đường dẫn ảnh.');
        return;
      }

      // optional: resize/compress before upload
      const manip = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      await uploadToSupabase(manip.uri);
    } catch (e: any) {
      console.error('pickAndUpload error', e);
      Alert.alert('Lỗi', e?.message || 'Không thể chọn ảnh');
    }
  };

  // upload using expo-file-system -> base64 -> ArrayBuffer -> supabase.storage.upload
  const uploadToSupabase = async (uri: string) => {
    setUploading(true);
    try {
      console.log('[upload] reading file as base64 from uri=', uri);
      // read local file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      console.log('[upload] base64 length', base64.length);

      // convert base64 -> ArrayBuffer
      const arrayBuffer = base64ToArrayBuffer(base64);
      // create file name
      const fileExt = 'jpg';
      const fileName = `avatars/${uuidv4()}.${fileExt}`;

      console.log('[upload] uploading to supabase, filename=', fileName);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatar')
        .upload(fileName, arrayBuffer as any, {
          cacheControl: '3600',
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('Supabase upload error', uploadError);
        throw uploadError;
      }
      console.log('[upload] uploadData', uploadData);

      // get public url (bucket must be public) OR createSignedUrl if private
      const publicUrlResponse = supabase.storage.from('avatar').getPublicUrl(fileName);
      console.log('[upload] publicUrlResponse', publicUrlResponse);

      const finalUrl = publicUrlResponse?.data?.publicUrl ?? '';

      if (!finalUrl) {
        console.warn('No public URL returned for uploaded avatar:', uploadData);
        Alert.alert('Cảnh báo', 'Upload thành công nhưng không lấy được public URL.');
      } else {
        setAvatar(finalUrl);
      }
    } catch (e: any) {
      console.error('uploadToSupabase error', e);
      Alert.alert('Lỗi upload', e?.message || 'Không upload được file.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!canAdd) return Alert.alert('Không có quyền', 'Bạn không được phép thêm khách hàng');

    if (!name || !phone || !service || !avatar || !nasLink) {
      return Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ tất cả các trường (bao gồm ảnh và link NAS).');
    }

    try {
      setLoading(true);
      await apiFetch('/wp-json/custom/v1/customers', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          name,
          phone,
          avatar,
          nas_link: nasLink,
          treatments: [
            {
              service,
              treatment_date: new Date().toISOString().split('T')[0],
              note: '',
            },
          ],
        }),
      });

      Alert.alert('✅ Thành công', 'Khách hàng đã được tạo.');
      setName(''); setPhone(''); setService(''); setAvatar(''); setNasLink('');
    } catch (err: any) {
      console.error('create customer error', err);
      Alert.alert('❌ Lỗi', err?.message || 'Không thể tạo khách hàng');
    } finally {
      setLoading(false);
    }
  };

  const PLACEHOLDER_COLOR = '#9CA3AF';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Text style={styles.heading}>Thêm khách hàng mới</Text>

          <TextInput placeholder="👤 Họ và tên khách hàng" placeholderTextColor={PLACEHOLDER_COLOR} value={name} onChangeText={setName} style={styles.input} />

          <TextInput placeholder="📞 Số điện thoại" placeholderTextColor={PLACEHOLDER_COLOR} value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} />

          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>🦷 Dịch vụ:</Text>
            <TouchableOpacity onPress={() => setServicePickerVisible(true)} style={styles.serviceSelect}>
              <Text style={[styles.serviceSelectText, !service && { color: PLACEHOLDER_COLOR }]}>{service || '-- Chọn dịch vụ --'}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={{ width: 120, height: 120, borderRadius: 12, marginBottom: 8 }} />
            ) : (
              <View style={{ width: 120, height: 120, borderRadius: 12, backgroundColor: '#eef2f7', marginBottom: 8, alignItems:'center', justifyContent:'center' }}>
                <Text style={{ color: '#9ca3af' }}>No photo</Text>
              </View>
            )}
            <TouchableOpacity onPress={pickAndUpload} style={{ backgroundColor: Colors.GOLD, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{uploading ? 'Đang upload...' : (avatar ? 'Đổi ảnh' : 'Chọn ảnh')}</Text>
            </TouchableOpacity>
          </View>

          <TextInput placeholder="🌐 Link NAS" placeholderTextColor={PLACEHOLDER_COLOR} value={nasLink} onChangeText={setNasLink} style={styles.input} />

          <TouchableOpacity style={[styles.button, (loading || uploading) ? styles.buttonDisabled : undefined]} onPress={handleSubmit} disabled={loading || uploading || !canAdd}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Tạo khách hàng</Text>}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </ScrollView>

      {servicePickerVisible && (
        <View style={modalStyles.overlay}>
          <View style={modalStyles.container}>
            <Text style={modalStyles.title}>Chọn dịch vụ</Text>
            <ScrollView style={{ width: '100%' }}>
              {SERVICES.map((s) => (
                <Pressable key={s} onPress={() => { setService(s); setServicePickerVisible(false); }} style={modalStyles.option}>
                  <Text style={{ fontWeight: '600', color: '#0f172a' }}>{s}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => { setService(''); setServicePickerVisible(false); }} style={modalStyles.clearBtn}>
                <Text style={{ color: '#ef4444', fontWeight: '700' }}>Xóa lựa chọn</Text>
              </Pressable>
            </ScrollView>
            <TouchableOpacity onPress={() => setServicePickerVisible(false)} style={modalStyles.closeBtn}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f7fa' },
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 24, color: '#0f172a', textAlign: 'center' },
  input: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e6e9ef',
    marginBottom: 16,
    fontSize: 14,
    color: '#0f172a',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e6e9ef',
    marginBottom: 16,
    overflow: 'hidden',
  },
  pickerLabel: { padding: 10, color: '#475569', fontWeight: '500' },
  serviceSelect: { padding: 12, paddingHorizontal: 14 },
  serviceSelectText: { fontSize: 14 },
  button: { backgroundColor: Colors.GOLD, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  buttonDisabled: { backgroundColor: '#93c5fd' },
});

const modalStyles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  container: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  option: { width: '100%', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  clearBtn: { marginTop: 8, paddingVertical: 12, alignItems: 'center' },
  closeBtn: { marginTop: 12, backgroundColor: Colors.GOLD, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
});
