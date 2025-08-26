// app/edit_customer/[id].tsx
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/services/api';
import { supabase } from '@/services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { decode as base64ToArrayBuffer } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import moment from 'moment';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
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
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { v4 as uuidv4 } from 'uuid';

type Treatment = { id:number; service:string; treatment_date:string; note?:string };
type CustomerDetail = {
  id: number;
  name: string;
  phone: string;
  avatar?: string | null;
  nas_link?: string | null;
  treatments: Treatment[];
};

const BASE = 'https://nhakhoaphuongsen.com/wp-json/custom/v1';
const CUSTOMER = `${BASE}/customers`;

const SERVICES = ['Thăm khám', 'Implant', 'Niềng răng', 'Bọc răng sứ'];

export default function EditCustomer() {
  const { can } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation: any = useNavigation();

  // set initial header
  useLayoutEffect(() => {
    navigation.setOptions({ title: `Chỉnh sửa khách hàng #${id}` });
  }, [navigation, id]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState<string>('');
  const [nasLink, setNasLink] = useState('');

  const [treatments, setTreatments] = useState<Treatment[]>([]);

  // date picker for adding/updating a treatment
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [editingTreatmentIdx, setEditingTreatmentIdx] = useState<number | null>(null);

  const selectedDate = useMemo(() => {
    const t = editingTreatmentIdx !== null ? treatments[editingTreatmentIdx] : null;
    return t?.treatment_date ? moment(t.treatment_date, 'YYYY-MM-DD').toDate() : new Date();
  }, [editingTreatmentIdx, treatments]);

  // update header title when we have the real name (better UX)
  useEffect(() => {
    if (name) navigation.setOptions({ title: `Chỉnh sửa: ${name}` });
  }, [name, navigation]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const detail = await apiFetch(`${CUSTOMER}/${id}`, { auth: true }) as CustomerDetail;
      setName(detail.name || '');
      setPhone(detail.phone || '');
      setAvatar(detail.avatar || '');
      setNasLink(detail.nas_link || '');
      setTreatments(Array.isArray(detail.treatments) ? detail.treatments : []);
    } catch (e:any) {
      Alert.alert('Lỗi tải dữ liệu', e?.message || 'Không lấy được thông tin khách hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetail(); }, [id]);

  // ---------- Avatar upload (giống add_customer) ----------
  const pickAndUpload = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') return Alert.alert('Quyền bị từ chối', 'Vui lòng cho phép truy cập ảnh để upload.');

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [1, 1],
      });
      if ((res as any).canceled) return;
      const uri = (res as any).assets?.[0]?.uri;
      if (!uri) return Alert.alert('Lỗi', 'Không lấy được ảnh.');

      const manip = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1024 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
      await uploadToSupabase(manip.uri);
    } catch (e:any) {
      Alert.alert('Lỗi', e?.message || 'Không thể chọn ảnh');
    }
  };

  const uploadToSupabase = async (uri: string) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const arrayBuffer = base64ToArrayBuffer(base64);
      const fileName = `avatars/${uuidv4()}.jpg`;

      const { error } = await supabase.storage.from('avatar').upload(fileName, arrayBuffer as any, {
        cacheControl: '3600',
        contentType: 'image/jpeg',
        upsert: false,
      });
      if (error) throw error;

      const publicUrl = supabase.storage.from('avatar').getPublicUrl(fileName).data.publicUrl;
      setAvatar(publicUrl);
    } catch (e:any) {
      Alert.alert('Lỗi upload', e?.message || 'Không upload được file.');
    }
  };

  // ---------- Save base info ----------
  const saveBase = async () => {
    if (!can('customer.add')) return Alert.alert('Không có quyền', 'Bạn không được phép chỉnh sửa');
    if (!name || !phone) return Alert.alert('Thiếu thông tin', 'Tên và điện thoại là bắt buộc');

    try {
      setSaving(true);
      await apiFetch(`${CUSTOMER}/${id}`, {
        method: 'PUT',
        auth: true,
        body: JSON.stringify({ name, phone, avatar, nas_link: nasLink }),
      });
      Alert.alert('Đã lưu', 'Thông tin khách hàng đã được cập nhật');
      fetchDetail();
    } catch (e:any) {
      Alert.alert('Lỗi', e?.message || 'Không thể lưu thông tin');
    } finally {
      setSaving(false);
    }
  };

  // ---------- Treatment helpers ----------
  const addTreatment = async () => {
    // correct index assignment using functional update
    const t: Treatment = { id: 0, service: SERVICES[0], treatment_date: moment().format('YYYY-MM-DD') };
    setTreatments(prev => {
      const newArr = [...prev, t];
      // set index to previous length (the new item index)
      setEditingTreatmentIdx(prev.length);
      return newArr;
    });
    setDatePickerVisible(true);
  };

  const saveTreatment = async (idx: number) => {
    const t = treatments[idx];
    try {
      setSaving(true);
      if (t.id && t.id > 0) {
        // update
        await apiFetch(`${CUSTOMER}/${id}/treatments/${t.id}`, {
          method: 'PUT',
          auth: true,
          body: JSON.stringify({ service: t.service, treatment_date: t.treatment_date, note: t.note || '' }),
        });
      } else {
        // create
        await apiFetch(`${CUSTOMER}/${id}/treatments`, {
          method: 'POST',
          auth: true,
          body: JSON.stringify({ service: t.service, treatment_date: t.treatment_date, note: t.note || '' }),
        });
      }

      Alert.alert('Thành công', 'Đã lưu điều trị.');
      await fetchDetail();
    } catch (e:any) {
      Alert.alert('Lỗi', e?.message || 'Không thể lưu điều trị');
    } finally {
      setSaving(false);
    }
  };

  const deleteTreatment = async (idx: number) => {
    const t = treatments[idx];
    if (!t.id) {
      setTreatments(prev => prev.filter((_, i) => i !== idx));
      return;
    }
    Alert.alert('Xóa điều trị?', `${t.service} • ${moment(t.treatment_date).format('DD/MM/YYYY')}`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa', style: 'destructive',
        onPress: async () => {
          try {
            setSaving(true);
            await apiFetch(`${CUSTOMER}/${id}/treatments/${t.id}`, { method: 'DELETE', auth: true });
            Alert.alert('Đã xóa', 'Điều trị đã được xóa.');
            await fetchDetail();
          } catch (e:any) {
            Alert.alert('Lỗi', e?.message || 'Không thể xóa điều trị');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator style={{ marginTop: 24 }} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* top summary card */}
          <View style={styles.headerCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.avatarWrap}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatarLarge} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={40} color="#ffffff66" />
                  </View>
                )}
              </View>
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text style={styles.nameTitle}>{name || `#${id}`}</Text>
                <Text style={styles.subText}>{phone || '—'}</Text>
                <Text numberOfLines={1} style={styles.subTextSmall}>{nasLink || 'Chưa có link NAS'}</Text>
              </View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => pickAndUpload()}>
                <Ionicons name="camera" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginTop: 12 }} />

          <Text style={styles.sectionTitle}>Thông tin cơ bản</Text>
          <View style={styles.formRow}>
            <Text style={styles.label}>Họ và tên</Text>
            <TextInput placeholder="Nhập họ và tên" style={styles.input} value={name} onChangeText={setName} />
          </View>

          <View style={styles.formRow}>
            <Text style={styles.label}>Số điện thoại</Text>
            <TextInput placeholder="Số điện thoại" style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>

          <View style={styles.formRow}>
            <Text style={styles.label}>Link NAS</Text>
            <TextInput placeholder="https://..." style={styles.input} value={nasLink} onChangeText={setNasLink} />
          </View>

          <TouchableOpacity style={[styles.primaryBtn, { marginTop: 6 }]} onPress={saveBase} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Lưu thông tin</Text>}
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Lịch sử điều trị</Text>

          {treatments.length === 0 && <Text style={styles.empty}>Chưa có điều trị nào — bạn có thể thêm.</Text>}

          {treatments.map((t, idx) => (
            <View key={`${t.id}-${idx}`} style={styles.treatCard}>
              <View style={styles.treatTop}>
                <Pressable
                  style={styles.servicePill}
                  onPress={() => {
                    const cur = t.service;
                    const next = SERVICES[(Math.max(0, SERVICES.indexOf(cur)) + 1) % SERVICES.length];
                    setTreatments(prev => {
                      const copy = prev.slice();
                      copy[idx] = { ...copy[idx], service: next };
                      return copy;
                    });
                  }}
                >
                  <Text style={styles.servicePillText}>{t.service}</Text>
                </Pressable>

                <TouchableOpacity
                  onPress={() => { setEditingTreatmentIdx(idx); setDatePickerVisible(true); }}
                  style={styles.dateBox}
                >
                  <Ionicons name="calendar" size={16} />
                  <Text style={{ marginLeft: 8 }}>{moment(t.treatment_date).format('DD/MM/YYYY')}</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                placeholder="Ghi chú (tuỳ chọn)"
                value={t.note || ''}
                onChangeText={(val) => {
                  setTreatments(prev => {
                    const copy = prev.slice();
                    copy[idx] = { ...copy[idx], note: val };
                    return copy;
                  });
                }}
                style={[styles.input, { marginTop: 10 }]}
              />

              <View style={{ flexDirection: 'row', marginTop: 10 }}>
                <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => saveTreatment(idx)} disabled={saving}>
                  <Text style={styles.secondaryBtnText}>Lưu</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.deleteBtn, { marginLeft: 8 }]} onPress={() => deleteTreatment(idx)} disabled={saving}>
                  <Text style={[styles.secondaryBtnText, { color: '#fff' }]}>Xóa</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity style={[styles.primaryBtn, { marginTop: 8 }]} onPress={addTreatment}>
            <Text style={styles.primaryBtnText}>+ Thêm điều trị</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.ghostBtn, { marginTop: 16 }]} onPress={() => router.back()}>
            <Text style={styles.ghostBtnText}>← Quay lại</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <DateTimePickerModal
        isVisible={datePickerVisible}
        mode="date"
        date={selectedDate}
        onConfirm={(d) => {
          if (editingTreatmentIdx === null) return setDatePickerVisible(false);
          setTreatments(prev => {
            const copy = prev.slice();
            copy[editingTreatmentIdx] = { ...copy[editingTreatmentIdx], treatment_date: moment(d).format('YYYY-MM-DD') };
            return copy;
          });
          setDatePickerVisible(false);
        }}
        onCancel={() => setDatePickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f6f8fb' },
  headerCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      default: { elevation: 3 },
    }),
  },
  avatarWrap: { width: 72, height: 72, borderRadius: 12, overflow: 'hidden', backgroundColor: '#eef2f7', alignItems: 'center', justifyContent: 'center' },
  avatarLarge: { width: 72, height: 72, borderRadius: 12 },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#c7d2fe', alignItems: 'center', justifyContent: 'center' },
  iconBtn: { marginLeft: 12, backgroundColor: Colors.GOLD, padding: 8, borderRadius: 10 },
  nameTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  subText: { color: '#374151', marginTop: 4 },
  subTextSmall: { color: '#6b7280', marginTop: 2, fontSize: 12 },

  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 8, marginBottom: 8, color: '#0f172a' },
  formRow: { marginBottom: 8 },

  label: { fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: '700' },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e6e9ef' },

  primaryBtn: { backgroundColor: Colors.GOLD, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  secondaryBtn: { backgroundColor: '#fff', paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e6e9ef' },
  secondaryBtnText: { color: '#0f172a', fontWeight: '700' },

  ghostBtn: { alignItems: 'center', paddingVertical: 10 },
  ghostBtnText: { color: '#475569', fontWeight: '700' },

  deleteBtn: { backgroundColor: '#ef4444', paddingVertical: 12, borderRadius: 10, alignItems: 'center', flex: 1 },

  treatCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e6e9ef',
    ...Platform.select({ ios: { shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.06, shadowRadius:8 }, default: { elevation: 2 } }),
  },
  treatTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  servicePill: { backgroundColor: '#eef2ff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  servicePillText: { color: '#0f172a', fontWeight: '700' },

  dateBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' },

  empty: { color: '#9ca3af', marginBottom: 8, fontStyle: 'italic' },
});
