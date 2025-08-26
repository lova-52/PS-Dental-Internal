// app/(tabs)/search_customer.tsx
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/services/api';
import { useRouter } from 'expo-router';

import moment from 'moment';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

type Treatment = { id:number; service:string; treatment_date:string; note?:string };
type RawItem = {
  id: number;
  name?: string;
  avatar?: string;
  nas_link?: string;
  phone?: string;
  created_at?: string;
  treatments?: Treatment[];
};

type Customer = {
  id: number;
  name: string;
  // ngày điều trị gần nhất (để sort/list)
  latestDateISO: string | '';
  latestDateLabel: string;
  avatar: string | null;
  phone: string;
  servicesAll: string[];       // tất cả loại điều trị của KH
  treatmentDates: string[];    // tất cả ngày điều trị (YYYY-MM-DD)
  raw: RawItem;
};

const WP_API_BASE = 'https://nhakhoaphuongsen.com';
const ENDPOINT = `${WP_API_BASE}/wp-json/custom/v1/customers`;

export default function SearchCustomer() {
  const { user } = useAuth();
  const router = useRouter();
  const canDelete = !!user?.roles?.some(r => ['telesale','assistant','administrator'].includes(r));

  const [searchText, setSearchText] = useState('');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<'start' | 'end' | null>(null);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const fetchCustomers = async () => {
    setError(null);
    try {
      if (!refreshing) setLoading(true);

      const params: string[] = [];
      if (startDate) params.push(`from=${encodeURIComponent(startDate)}`);
      if (endDate) params.push(`to=${encodeURIComponent(endDate)}`);
      if (searchText) params.push(`q=${encodeURIComponent(searchText)}`);

      const url = params.length ? `${ENDPOINT}?${params.join('&')}` : ENDPOINT;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: RawItem[] = await res.json();

      const mapped: Customer[] = json.map((r) => {
        const treatments = Array.isArray(r.treatments) ? r.treatments.slice() : [];

        // sort để lấy ngày mới nhất
        const sorted = treatments.slice().sort((a, b) =>
          (b.treatment_date || '').localeCompare(a.treatment_date || ''),
        );
        const latest = sorted[0];

        const servicesAll = [...new Set(treatments
          .map(t => (t.service || '').trim())
          .filter(Boolean))];

        const treatmentDates = treatments
          .map(t => (t.treatment_date || '').slice(0,10))
          .filter(Boolean);

        return {
          id: r.id,
          name: r.name ?? '',
          latestDateISO: latest?.treatment_date ?? '',
          latestDateLabel: latest?.treatment_date ? moment(latest.treatment_date).format('DD/MM/YYYY') : '',
          avatar: r.avatar ?? null,
          phone: r.phone ?? '',
          servicesAll,
          treatmentDates,
          raw: r,
        };
      });

      // sort theo ngày mới nhất desc (không có ngày => xuống cuối)
      mapped.sort((a, b) => {
        if (!a.latestDateISO && !b.latestDateISO) return 0;
        if (!a.latestDateISO) return 1;
        if (!b.latestDateISO) return -1;
        return b.latestDateISO.localeCompare(a.latestDateISO);
      });

      setCustomers(mapped);
    } catch (err: any) {
      console.error('Fetch customers error:', err);
      setError(err.message || 'Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // tất cả services rút ra từ toàn bộ treatments của toàn bộ khách
  const servicesList = useMemo(() => {
    const s = new Set<string>();
    customers.forEach((c) => c.servicesAll.forEach(v => s.add(v)));
    return Array.from(s).sort();
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return customers.filter((c) => {
      // search theo tên/điện thoại
      if (q) {
        const inName = c.name.toLowerCase().includes(q);
        const inPhone = c.phone && c.phone.includes(q);
        if (!inName && !inPhone) return false;
      }

      // lọc theo service: bất kỳ treatment nào có service đã chọn
      if (selectedService && !c.servicesAll.includes(selectedService)) {
        return false;
      }

      // lọc theo khoảng ngày: nếu đặt khoảng, pass nếu BẤT KỲ ngày điều trị nằm trong khoảng
      if (startDate || endDate) {
        if (!c.treatmentDates.length) return false;
        const start = startDate ? moment(startDate, 'YYYY-MM-DD').startOf('day') : null;
        const end   = endDate   ? moment(endDate, 'YYYY-MM-DD').endOf('day')   : null;

        const anyInRange = c.treatmentDates.some(d => {
          const m = moment(d, 'YYYY-MM-DD');
          if (start && m.isBefore(start, 'day')) return false;
          if (end && m.isAfter(end, 'day')) return false;
          return true;
        });

        if (!anyInRange) return false;
      }

      return true;
    });
  }, [customers, searchText, selectedService, startDate, endDate]);

  const openDatePicker = (which: 'start' | 'end') => { setPickerMode(which); setDatePickerVisible(true); };
  const handleConfirmDate = (dateObj: Date) => {
    const iso = moment(dateObj).format('YYYY-MM-DD');
    if (pickerMode === 'start') setStartDate(iso); else setEndDate(iso);
    setDatePickerVisible(false); setPickerMode(null);
  };
  const clearFilters = () => { setSearchText(''); setSelectedService(null); setStartDate(null); setEndDate(null); };
  const onRefresh = () => { setRefreshing(true); fetchCustomers(); };

  const openNAS = async (url?: string | null) => {
    if (!url) return Alert.alert('Không có đường dẫn NAS');
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else Alert.alert('Không thể mở đường dẫn');
    } catch { Alert.alert('Lỗi mở liên kết'); }
  };

  const deleteCustomer = async (id: number) => {
    if (!canDelete) return Alert.alert('Không có quyền', 'Bạn không được phép xóa khách hàng');

    Alert.alert('Xác nhận', 'Bạn có chắc muốn xóa khách hàng này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa', style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`${ENDPOINT}/${id}`, { method: 'DELETE', auth: true });
            Alert.alert('Đã xóa', 'Khách hàng đã được xóa.');
            setSelectedCustomer(null);
            fetchCustomers();
          } catch (err: any) {
            Alert.alert('Lỗi', err?.message || 'Không thể xóa khách hàng');
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
  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={{ color: 'red', textAlign: 'center', marginTop: 12 }}>{error}</Text>
        <TouchableOpacity onPress={fetchCustomers} style={{ marginTop: 12, alignSelf: 'center' }}>
          <Text style={{ color: '#0f6ef6' }}>Thử lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.heading}>Tìm kiếm khách hàng</Text>

      <View style={styles.row}>
        <TextInput
          style={styles.searchBox}
          placeholder="🔍 Nhập tên hoặc số điện thoại..."
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.clearButton} onPress={() => { if (searchText) setSearchText(''); else clearFilters(); }}>
          <Text style={styles.clearText}>{searchText ? 'X' : 'Clear'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chipsWrap}>
        <Pressable onPress={() => setSelectedService(null)} style={[styles.chip, selectedService === null ? styles.chipActive : undefined, { marginRight: 8 }]}>
          <Text style={selectedService === null ? styles.chipActiveText : styles.chipText}>Tất cả</Text>
        </Pressable>
        {servicesList.map((s) => {
          const active = selectedService === s;
          return (
            <Pressable key={s} onPress={() => setSelectedService(active ? null : s)} style={[styles.chip, active ? styles.chipActive : undefined]}>
              <Text style={active ? styles.chipActiveText : styles.chipText}>{s}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.dateRow}>
        <Pressable style={styles.dateBox} onPress={() => openDatePicker('start')}>
          <Text style={styles.dateLabel}>Từ</Text>
          <Text style={styles.dateValue}>{startDate ? moment(startDate).format('DD/MM/YYYY') : 'Chọn ngày'}</Text>
        </Pressable>
        <Pressable style={styles.dateBox} onPress={() => openDatePicker('end')}>
          <Text style={styles.dateLabel}>Đến</Text>
          <Text style={styles.dateValue}>{endDate ? moment(endDate).format('DD/MM/YYYY') : 'Chọn ngày'}</Text>
        </Pressable>
        <TouchableOpacity style={styles.resetDateBtn} onPress={() => { setStartDate(null); setEndDate(null); }}>
          <Text style={styles.resetDateText}>Đặt lại</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.resultRow}>
        <Text style={styles.resultText}>Kết quả: {filteredCustomers.length}</Text>
        <Text style={styles.hintText}>
          {searchText ? ` Tìm: "${searchText}"` : ''}{selectedService ? ` • Dịch vụ: ${selectedService}` : ''}{(startDate || endDate) ? ` • Ngày: ${startDate ?? '—'} → ${endDate ?? '—'}` : ''}
        </Text>
      </View>

      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item, index }) => (
          <Pressable onPress={() => setSelectedCustomer(item)}>
            <View style={styles.card}>
              <Text style={styles.index}>{index + 1}</Text>
              <Image source={{ uri: item.avatar ?? undefined }} style={styles.avatar} />
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>📞 {item.phone || '-'}</Text>
                <View style={{ flexDirection: 'row', marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* hiển thị tất cả services của KH */}
                  <View style={styles.serviceBadge}>
                    <Text style={styles.serviceBadgeText}>{item.servicesAll.join(' • ') || '-'}</Text>
                  </View>
                  <Text style={styles.dateText}>  •  {item.latestDateLabel || '-'}</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.nasButton} onPress={() => openNAS(item.raw.nas_link)}>
                <Text style={styles.nasButtonText}>Mở NAS</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Không tìm thấy khách hàng</Text>}
      />

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirmDate}
        onCancel={() => { setDatePickerVisible(false); setPickerMode(null); }}
        maximumDate={new Date(2100, 12, 31)}
        minimumDate={new Date(2000, 1, 1)}
      />

      <Modal visible={selectedCustomer !== null} transparent animationType="slide" onRequestClose={() => setSelectedCustomer(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {selectedCustomer && (
              <>
                <View style={styles.modalHeader}>
                  <Image source={{ uri: selectedCustomer.avatar ?? undefined }} style={styles.modalAvatar} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.modalName}>{selectedCustomer.name}</Text>
                    <Text style={styles.modalMeta}>📞 {selectedCustomer.phone || '-'}</Text>
                    <Text style={styles.modalMetaSmall}>🦷 {selectedCustomer.servicesAll.join(' • ') || '-'} • {selectedCustomer.latestDateLabel || '-'}</Text>
                  </View>
                </View>

                <View style={{ marginTop: 16 }}>
                  <TouchableOpacity
                    style={styles.modalAction}
                    onPress={() => {
                      setSelectedCustomer(null);
                      router.push({ pathname: '/edit_customer', params: { id: String(selectedCustomer.id) } });
                    }}
                  >
                    <Text style={styles.modalActionText}>📝 Chỉnh sửa thông tin</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.modalAction} onPress={() => openNAS(selectedCustomer.raw.nas_link)}>
                    <Text style={styles.modalActionText}>📁 Mở hồ sơ NAS</Text>
                  </TouchableOpacity>

                  {canDelete && (
                    <TouchableOpacity style={[styles.modalAction, styles.deleteAction]} onPress={() => deleteCustomer(selectedCustomer.id)}>
                      <Text style={[styles.modalActionText, { color: '#fff' }]}>🗑️ Xóa khách</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={[styles.modalAction, styles.closeButton]} onPress={() => setSelectedCustomer(null)}>
                    <Text style={[styles.modalActionText, { color: '#fff' }]}>Đóng</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// giữ nguyên styles của bạn (đoạn dưới không đổi nhiều)
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f7fa' },
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 12, textAlign: 'center', color: '#0f172a' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  searchBox: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e6e9ef' },
  clearButton: { marginLeft: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  clearText: { color: '#333', fontWeight: '600' },
  chipsWrap: { flexDirection: 'row', marginBottom: 12, flexWrap: 'wrap' },
  chip: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#eee', marginBottom: 8 },
  chipActive: { backgroundColor: Colors.GOLD, borderColor: Colors.GOLD },
  chipText: { color: '#333' },
  chipActiveText: { color: '#fff', fontWeight: '600' },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dateBox: { flex: 1, padding: 10, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e6e9ef', marginRight: 8 },
  dateLabel: { fontSize: 12, color: '#8892a6' },
  dateValue: { marginTop: 4, fontWeight: '600' },
  resetDateBtn: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  resetDateText: { color: Colors.GOLD_DEEP, fontWeight: '600' },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  resultText: { fontWeight: '700', color: '#0f172a' },
  hintText: { color: '#6b7280', fontSize: 12 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 12 },
  index: { width: 28, color: '#6b7280', fontWeight: '600' },
  avatar: { width: 64, height: 64, borderRadius: 12, marginRight: 12, backgroundColor: '#eee' },
  info: { flex: 1 },
  name: { fontWeight: '700', fontSize: 16, color: '#0f172a' },
  meta: { color: '#6b7280', marginTop: 2 },
  serviceBadge: { backgroundColor: '#eef2ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  serviceBadgeText: { color: '#bbb802ff', fontWeight: '600', fontSize: 12 },
  dateText: { color: '#6b7280', fontSize: 12 },
  nasButton: { backgroundColor: Colors.GOLD, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  nasButtonText: { color: '#fff', fontWeight: '700' },
  empty: { marginTop: 40, textAlign: 'center', color: '#9ca3af' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '92%', backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center' },
  modalAvatar: { width: 72, height: 72, borderRadius: 12 },
  modalName: { fontSize: 18, fontWeight: '700' },
  modalMeta: { color: '#374151', marginTop: 4 },
  modalMetaSmall: { color: '#6b7280', marginTop: 2 },
  modalAction: { marginTop: 12, padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, alignItems: 'center' },
  modalActionText: { fontWeight: '700', color: '#0f172a' },
  closeButton: { backgroundColor: Colors.GOLD, marginTop: 16 },
  deleteAction: { backgroundColor: '#ef4444', marginTop: 12 },
});
