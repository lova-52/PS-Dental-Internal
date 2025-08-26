// app/(tabs)/manage_appointment.tsx
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/services/api';
import moment from 'moment';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  InteractionManager,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { SafeAreaView } from 'react-native-safe-area-context';


const ENDPOINT_APPTS = `/wp-json/custom/v1/appointments`;
const ENDPOINT_CUSTOMERS = `/wp-json/custom/v1/customers`;

/** Tạo ma trận ngày trong tháng để vẽ calendar */
function buildMonthMatrix(year: number, monthIndex: number) {
  const first = moment({year, month: monthIndex, day: 1});
  const daysInMonth = first.daysInMonth();
  const startWeekday = first.day(); // 0..6 (CN..T7)
  const rows: (string | null)[][] = [];
  for (let r=0; r<6; r++) {
    const row: (string|null)[] = []; 
    for (let c=0; c<7; c++) {
      const cellIndex = r*7 + c;
      const dayNum = cellIndex - startWeekday + 1;
      if (cellIndex < startWeekday || dayNum > daysInMonth) row.push(null);
      else row.push(moment({year, month: monthIndex, day: dayNum}).format('YYYY-MM-DD'));
    }
    rows.push(row);
  }
  return rows;
}

type Appt = {
  id: number;
  customer_name: string;
  customer_phone?: string;
  customer_birthday?: string | null;
  customer_id?: number | null;
  service?: string;
  staff?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
};

type CustomerShort = {
  id: number;
  name: string;
  phone?: string;
  avatar?: string | null;
};

export default function ManageAppointmentScreen() {
  const { can } = useAuth(); // lấy permission từ context
  const canCreate = can('appt.create');
  const canUpdate = can('appt.update');
  const canDelete = can('appt.delete');

  const [yearMonth, setYearMonth] = useState(moment());
  const [monthMatrix, setMonthMatrix] = useState<(string | null)[][]>([]);
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // form includes optional customer_id
  const [form, setForm] = useState({ customer_id: null as number | null, customer_name:'', customer_phone:'', customer_birthday:'', staff:'', service:'', time: '09:00' });
  const [timePickerVisible, setTimePickerVisible] = useState(false);

  const [editAppt, setEditAppt] = useState<Appt | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [datePickerVisibleForBirthday, setDatePickerVisibleForBirthday] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  // customer picker states
  const [customerPickerVisible, setCustomerPickerVisible] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerShort[]>([]);
  const searchTimer = useRef<number | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const f = yearMonth.clone().startOf('month').format('YYYY-MM-DD');
      const t = yearMonth.clone().endOf('month').format('YYYY-MM-DD');
      await fetchApptsRange(f, t);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setMonthMatrix(buildMonthMatrix(yearMonth.year(), yearMonth.month()));
    const from = yearMonth.clone().startOf('month').format('YYYY-MM-DD');
    const to   = yearMonth.clone().endOf('month').format('YYYY-MM-DD');
    fetchApptsRange(from, to);
  }, [yearMonth]);

  const fetchApptsRange = async (from: string, to: string) => {
    setLoading(true);
    try {
      const json = await apiFetch(`${ENDPOINT_APPTS}?from=${from}&to=${to}`, { auth: true });
      const rows = (json as any).data ?? json;
      setAppointments(rows);
    } catch (e: any) {
      Alert.alert('Lỗi', 'Không lấy được dữ liệu lịch:\n' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const apptsByDate = useMemo(() => {
    const map = new Map<string, Appt[]>();
    appointments.forEach((a: any) => {
      const d = a.date;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(a);
    });
    return map;
  }, [appointments]);

  const openDay = (dateISO: string) => {
    setSelectedDay(dateISO);
    setModalVisible(true);
  };

  // ---------- Customer picker helpers ----------
  const fetchCustomersForPicker = async (q: string) => {
    console.log('[picker] fetchCustomersForPicker start q=', q);
    console.time('[picker] fetchCustomersForPicker');
    setCustomerLoading(true);
    try {
      const queryStr = q ? `?q=${encodeURIComponent(q)}` : '';
      const json = await apiFetch(`${ENDPOINT_CUSTOMERS}${queryStr}`, { auth: true });
      const rows = (json as any).data ?? json;
      // Map to short
      const mapped: CustomerShort[] = (rows ?? []).map((r: any) => ({
        id: r.id,
        name: r.name ?? r.ten_khach_hang ?? '',
        phone: r.phone ?? r.phone ?? '',
        avatar: r.avatar ?? null
      }));
      setCustomerResults(mapped);
      console.log('[picker] fetch done count=', (mapped ?? []).length);
    } catch (err:any) {
      console.error('[picker] fetch customers error', err);
      setCustomerResults([]);
    } finally {
      setCustomerLoading(false);
      console.timeEnd('[picker] fetchCustomersForPicker');
    }
  };

  // debounce query
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      // Important: postpone heavy work so it won't block immediate UI action
      InteractionManager.runAfterInteractions(() => {
        fetchCustomersForPicker(customerQuery);
      });
    }, 220) as unknown as number;
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerQuery]);

  const openCustomerPicker = async () => {
    try {
      console.log('[picker] openCustomerPicker requested');
      // show empty results quickly (so overlay appears fast)
      setCustomerResults([]);
      setCustomerQuery('');
      setCustomerPickerVisible(true);

      // Delay heavy fetch until UI has finished transitions
      InteractionManager.runAfterInteractions(() => {
        console.log('[picker] runAfterInteractions -> start fetch');
        // measure time
        console.time('[picker] initialFetch');
        fetchCustomersForPicker('').finally(() => console.timeEnd('[picker] initialFetch'));
      });
    } catch (e) {
      console.error('[picker] openCustomerPicker error', e);
      // fallback: still open picker but show error
      setCustomerPickerVisible(true);
    }
  };

  const selectCustomer = (c: CustomerShort) => {
    console.log('[picker] selected customer', c?.id, c?.name);
    // update form immediately
    setForm(prev => ({ ...prev, customer_id: c.id, customer_name: c.name, customer_phone: c.phone ?? '' }));

    // close overlay after interactions to avoid jank
    InteractionManager.runAfterInteractions(() => {
      setCustomerPickerVisible(false);
    });
  };

  // ---------- CREATE ----------
  const createAppointment = async () => {
    if (!selectedDay) return;
    if (!form.customer_name || !form.time) {
      return Alert.alert('Thiếu', 'Vui lòng nhập tên và giờ');
    }
    if (!canCreate) {
      return Alert.alert('Không có quyền', 'Bạn không được phép tạo lịch');
    }

    const payload: any = {
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      customer_birthday: form.customer_birthday || null,
      service: form.service,
      staff: form.staff,
      date: selectedDay,
      time: form.time + ':00'
    };
    // nếu có customer_id -> gửi kèm (backend sẽ xử lý nếu cột tồn tại)
    if (form.customer_id) payload.customer_id = form.customer_id;

    try {
      await apiFetch(ENDPOINT_APPTS, { method: 'POST', body: JSON.stringify(payload), auth: true });
      const f = yearMonth.clone().startOf('month').format('YYYY-MM-DD');
      const t = yearMonth.clone().endOf('month').format('YYYY-MM-DD');
      await fetchApptsRange(f, t);
      setForm({ customer_id: null, customer_name:'', customer_phone:'', customer_birthday:'', staff:'', service:'', time:'09:00' });
    } catch (e:any) {
      Alert.alert('Lỗi', e.message || 'Không thể tạo lịch');
    }
  };

  // ---------- DELETE ----------
  const deleteAppt = async (id:number) => {
    if (!canDelete) return Alert.alert('Không có quyền', 'Bạn không được phép xoá lịch');
    Alert.alert('Xác nhận', 'Xóa lịch này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa', style: 'destructive', onPress: async () => {
          try {
            setEditLoading(true);
            await apiFetch(`${ENDPOINT_APPTS}/${id}`, { method: 'DELETE', auth: true });
            const f = yearMonth.clone().startOf('month').format('YYYY-MM-DD');
            const t = yearMonth.clone().endOf('month').format('YYYY-MM-DD');
            await fetchApptsRange(f, t);
            setEditModalVisible(false);
            setModalVisible(false);
            setSelectedDay(null);
            setEditAppt(null);
          } catch (e:any) {
            Alert.alert('Lỗi', e.message || 'Không xoá được');
          } finally {
            setEditLoading(false);
          }
        }
      }
    ]);
  };

  // OPEN EDIT
  const openEdit = (a: Appt) => {
    setEditAppt({ ...a });
    setEditModalVisible(true);
  };

  // UPDATE
  const updateAppt = async () => {
    if (!editAppt) return;
    if (!canUpdate) return Alert.alert('Không có quyền', 'Bạn không được phép sửa lịch');
    if (!editAppt.customer_name || !editAppt.time) {
      return Alert.alert('Thiếu', 'Vui lòng nhập tên và giờ');
    }
    setEditLoading(true);
    try {
      const payload: any = {
        customer_name: editAppt.customer_name,
        customer_phone: editAppt.customer_phone,
        customer_birthday: editAppt.customer_birthday || null,
        service: editAppt.service,
        staff: editAppt.staff,
        date: editAppt.date,
        time: editAppt.time
      };
      if ((editAppt as any).customer_id) payload.customer_id = (editAppt as any).customer_id;
      await apiFetch(`${ENDPOINT_APPTS}/${editAppt.id}`, { method: 'PUT', body: JSON.stringify(payload), auth: true });
      const f = yearMonth.clone().startOf('month').format('YYYY-MM-DD');
      const t = yearMonth.clone().endOf('month').format('YYYY-MM-DD');
      await fetchApptsRange(f, t);
      setEditModalVisible(false);
      setEditAppt(null);
      setModalVisible(false);
      setSelectedDay(null);
    } catch (e:any) {
      Alert.alert('Lỗi', e.message || 'Không cập nhật được');
    } finally {
      setEditLoading(false);
    }
  };

  const prevMonth = () => setYearMonth(y => y.clone().subtract(1,'month'));
  const nextMonth = () => setYearMonth(y => y.clone().add(1,'month'));

  return (
    <SafeAreaView style={{flex:1, padding:12, backgroundColor:'#f6f7fb'}}>
      <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
        <TouchableOpacity onPress={prevMonth}><Text style={{fontSize:18}}>‹</Text></TouchableOpacity>
        <Text style={{fontSize:18, fontWeight:'700'}}>{yearMonth.format('MMMM YYYY')}</Text>
        <TouchableOpacity onPress={nextMonth}><Text style={{fontSize:18}}>›</Text></TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator style={{marginTop:20}}/> : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:6}}>
            {['CN','T2','T3','T4','T5','T6','T7'].map(d=>(<Text key={d} style={{width:`${100/7}%`, textAlign:'center', fontWeight:'600', color:'#6b7280'}}>{d}</Text>))}
          </View>

          <View>
            {monthMatrix.map((row, rIndex) => (
              <View key={rIndex} style={{flexDirection:'row', justifyContent:'space-between', marginBottom:8}}>
                {row.map((cell, cIndex) => {
                  if (!cell) return <View key={cIndex} style={{width:`${100/7}%`, height:72}} />;
                  const dayNum = moment(cell).date();
                  const has = apptsByDate.get(cell);
                  const isToday = moment().format('YYYY-MM-DD') === cell;
                  return (
                    <TouchableOpacity key={cIndex} onPress={() => openDay(cell)} style={{width:`${100/7}%`, padding:4}}>
                      <View style={[
                        styles.dayBox,
                        has && styles.dayHas,
                        isToday && {borderColor:'#0f6ef6', borderWidth:1}
                      ]}>
                        <Text style={{fontWeight:'700', color:'#0f172a'}}>{dayNum}</Text>
                        {has ? <Text style={{fontSize:11, marginTop:6}}>{has.length} đặt</Text> : <View style={{height:18}}/>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Modal danh sách + tạo mới */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="overFullScreen" transparent onRequestClose={() => {setModalVisible(false); setSelectedDay(null);}}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { position: 'relative' }]}>
            <Text style={{fontWeight:'700', fontSize:16, marginBottom:8}}>
              Lịch {selectedDay ? moment(selectedDay).format('DD/MM/YYYY') : ''}
            </Text>

            <FlatList
              data={selectedDay ? (apptsByDate.get(selectedDay) || []) : []}
              keyExtractor={(it:any)=>String(it.id)}
              ListEmptyComponent={<Text style={{color:'#6b7280'}}>Chưa có appointment</Text>}
              renderItem={({item})=>(
                <TouchableOpacity onPress={() => openEdit(item)} style={{padding:8, borderRadius:8, backgroundColor:'#fff', marginBottom:8, flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                  <View>
                    <Text style={{fontWeight:'700'}}>{item.customer_name}</Text>
                    <Text style={{color:'#6b7280'}}>{item.customer_phone} • {moment(item.time,'HH:mm:ss').format('HH:mm')}</Text>
                    <Text style={{color:'#6b7280'}}>{item.service} — {item.staff}</Text>
                  </View>
                  <Text style={{color:'#b88418'}}>Sửa</Text>
                </TouchableOpacity>
              )}
              style={{maxHeight:200, marginBottom:8}}
            />

            <View style={{borderTopWidth:1, borderTopColor:'#eee', paddingTop:8}}>
              <Text style={{fontWeight:'700', marginBottom:6}}>Thêm appointment</Text>

              {/* CHỌN KHÁCH HÀNG: mở picker nằm BÊN TRONG modalContainer để luôn ở trên */}
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss(); // ẩn keyboard để overlay không bị che
                  openCustomerPicker();
                }}
                style={[styles.input, {justifyContent:'center'}]}
              >
                <Text>{form.customer_name ? `${form.customer_name} ${form.customer_phone ? `• ${form.customer_phone}` : ''}` : 'Chọn khách hàng có sẵn hoặc tìm...'}</Text>
              </TouchableOpacity>

              {/* removed fallback name/phone inputs per request */}

              <TextInput placeholder="Dịch vụ" value={form.service} onChangeText={(v)=>setForm({...form, service:v})} style={styles.input} editable={canCreate}/>
              <TextInput placeholder="Nhân viên" value={form.staff} onChangeText={(v)=>setForm({...form, staff:v})} style={styles.input} editable={canCreate}/>

              <TouchableOpacity disabled={!canCreate} onPress={()=> setTimePickerVisible(true)} style={[styles.input, {justifyContent:'center', opacity: canCreate ? 1 : 0.5}]}>
                <Text>Giờ: {form.time}</Text>
              </TouchableOpacity>

              <TouchableOpacity disabled={!canCreate} onPress={createAppointment} style={{backgroundColor: canCreate ? '#b88418' : '#93c5fd', padding:12, borderRadius:8, marginTop:8, alignItems:'center'}}>
                <Text style={{color:'#fff', fontWeight:'700'}}>Tạo appointment</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { setModalVisible(false); setSelectedDay(null); }} style={{marginTop:8, alignItems:'center'}}>
                <Text style={{color:'#6b7280'}}>Đóng</Text>
              </TouchableOpacity>
            </View>

            {/* --- picker overlay nằm BÊN TRONG modalContainer để luôn hiện trên modal này --- */}
            {customerPickerVisible ? (
              <View style={styles.inlineOverlayInsideModal} pointerEvents="auto">
                <View style={styles.pickerInner}>
                  <Text style={{fontWeight:'700', fontSize:16, marginBottom:8}}>Chọn khách hàng</Text>

                  <TextInput
                    placeholder="Tìm tên hoặc số điện thoại..."
                    value={customerQuery}
                    onChangeText={setCustomerQuery}
                    style={styles.input}
                    autoFocus={Platform.OS !== 'web'}
                    returnKeyType="search"
                  />
                  {customerLoading ? <ActivityIndicator/> : null}

                  <FlatList
                    data={customerResults}
                    keyExtractor={(it:any) => String(it.id)}
                    renderItem={({item}) => (
                      <Pressable onPress={() => selectCustomer(item)} style={{flexDirection:'row', padding:8, alignItems:'center', borderRadius:8, backgroundColor:'#fff', marginBottom:8}}>
                        <Image source={{uri: item.avatar ?? undefined}} style={{width:48, height:48, borderRadius:8, backgroundColor:'#eee', marginRight:8}} />
                        <View style={{flex:1}}>
                          <Text style={{fontWeight:'700'}}>{item.name}</Text>
                          <Text style={{color:'#6b7280'}}>{item.phone ?? '-'}</Text>
                        </View>
                        <Text style={{color:'#b88418'}}>Chọn</Text>
                      </Pressable>
                    )}
                    style={{marginTop:8}}
                    ListEmptyComponent={<Text style={{color:'#6b7280', textAlign:'center', marginTop:8}}>Không tìm thấy</Text>}
                    keyboardShouldPersistTaps="handled"
                    initialNumToRender={6}
                    maxToRenderPerBatch={6}
                    windowSize={5}
                    removeClippedSubviews={true}
                  />

                  <TouchableOpacity onPress={() => { setCustomerPickerVisible(false); }} style={{marginTop:8, alignItems:'center'}}>
                    <Text style={{color:'#6b7280'}}>Đóng</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

          </View>
        </View>
      </Modal>

      {/* EDIT modal */}
      <Modal visible={editModalVisible} animationType="slide" presentationStyle="overFullScreen" transparent onRequestClose={() => { setEditModalVisible(false); setEditAppt(null); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={{fontWeight:'700', fontSize:16, marginBottom:8}}>Sửa lịch</Text>

            {editAppt ? (
              <>
                <TextInput placeholder="Họ và tên" value={editAppt.customer_name} onChangeText={(v)=> setEditAppt({...editAppt, customer_name: v})} style={styles.input} editable={canUpdate}/>
                <TextInput placeholder="Số điện thoại" value={editAppt.customer_phone} onChangeText={(v)=> setEditAppt({...editAppt, customer_phone: v})} style={styles.input} editable={canUpdate}/>

                <TouchableOpacity style={[styles.input, {opacity: canUpdate ? 1 : 0.5}]} onPress={() => canUpdate && setDatePickerVisibleForBirthday(true)}>
                  <Text>{editAppt.customer_birthday ? moment(editAppt.customer_birthday).format('DD/MM/YYYY') : 'Ngày sinh (tùy chọn)'}</Text>
                </TouchableOpacity>

                <TextInput placeholder="Dịch vụ" value={editAppt.service} onChangeText={(v)=> setEditAppt({...editAppt, service: v})} style={styles.input} editable={canUpdate}/>
                <TextInput placeholder="Nhân viên" value={editAppt.staff} onChangeText={(v)=> setEditAppt({...editAppt, staff: v})} style={styles.input} editable={canUpdate}/>

                <TouchableOpacity style={[styles.input, {justifyContent:'center', opacity: canUpdate ? 1 : 0.5}]} onPress={() => canUpdate && setTimePickerVisible(true)}>
                  <Text>Giờ: {editAppt.time ? moment(editAppt.time, 'HH:mm:ss').format('HH:mm') : 'Chọn giờ'}</Text>
                </TouchableOpacity>

                <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:8}}>
                  <TouchableOpacity onPress={updateAppt} disabled={!canUpdate || editLoading} style={{flex:1, backgroundColor: canUpdate ? '#b88418' : '#d29b1f', padding:12, borderRadius:8, alignItems:'center', marginRight:8}}>
                    {editLoading ? <ActivityIndicator color="#fff"/> : <Text style={{color:'#fff', fontWeight:'700'}}>Lưu</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => deleteAppt(editAppt.id)} disabled={!canDelete || editLoading} style={{flex:1, backgroundColor:'#fff', padding:12, borderRadius:8, alignItems:'center', borderWidth:1, borderColor: canDelete ? '#ef4444' : '#e5e7eb', opacity: canDelete ? 1 : 0.5}}>
                    <Text style={{color: canDelete ? '#ef4444' : '#9ca3af', fontWeight:'700'}}>Xóa</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => { setEditModalVisible(false); setEditAppt(null); }} style={{marginTop:8, alignItems:'center'}}>
                  <Text style={{color:'#6b7280'}}>Hủy</Text>
                </TouchableOpacity>

                <DateTimePickerModal
                  isVisible={datePickerVisibleForBirthday}
                  mode="date"
                  onConfirm={(d) => {
                    const iso = moment(d).format('YYYY-MM-DD');
                    setEditAppt(prev => prev ? {...prev, customer_birthday: iso} : prev);
                    setDatePickerVisibleForBirthday(false);
                  }}
                  onCancel={() => setDatePickerVisibleForBirthday(false)}
                />
              </>
            ) : <Text>Không có dữ liệu chỉnh sửa</Text>}
          </View>
        </View>
      </Modal>

      <DateTimePickerModal
        isVisible={timePickerVisible}
        mode="time"
        onConfirm={(d)=> {
          const hhmm = moment(d).format('HH:mm');
          if (editAppt) setEditAppt({...editAppt, time: hhmm + ':00'});
          else setForm({...form, time: hhmm});
          setTimePickerVisible(false);
        }}
        onCancel={()=> setTimePickerVisible(false)}
        is24Hour
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  dayBox: { backgroundColor:'#fff', borderRadius:8, padding:8, alignItems:'center', minHeight:64, justifyContent:'center'},
  dayHas: { backgroundColor:'#eef6ff' },
  modalOverlay: { flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'rgba(0,0,0,0.35)', padding:12 },
  modalContainer: { width:'100%', maxHeight:'92%', backgroundColor:'#fff', borderRadius:12, padding:12 },
  input: { backgroundColor:'#f7fafc', padding:10, borderRadius:8, marginBottom:8 },

  // picker overlay inside modal
  inlineOverlayInsideModal: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,         // hiển thị phía trên nội dung modal
    bottom: 12,
    zIndex: 9999,
    elevation: 9999,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  pickerInner: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    // drop shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
});
