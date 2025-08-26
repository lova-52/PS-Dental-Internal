// app/(auth)/login.tsx
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Image, Keyboard, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // animations (refs)
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.98)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;

  // base top (safe distance from notch/statusbar).
  const baseLogoTop = insets.top + (Platform.OS === 'ios' ? 60 : 16);

  useEffect(() => {
    // intro animation (small upward movement)
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1.04,
          duration: 380,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(220),
      Animated.parallel([
        Animated.timing(logoTranslateY, {
          toValue: -Math.min(60, SCREEN_HEIGHT * 0.06),
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1.02,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(formOpacity, {
          toValue: 1,
          duration: 340,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [logoOpacity, logoTranslateY, logoScale, formOpacity]);

  // Keyboard listeners: khi bàn phím hiện -> ẩn/đẩy logo lên, khi ẩn -> phục hồi
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = () => {
      setKeyboardVisible(true);
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 0.85,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 0.78,
          duration: 220,
          useNativeDriver: true,
        }),
        // translateY lên cao hơn (đảm bảo form có chỗ)
        Animated.timing(logoTranslateY, {
          toValue: -Math.min(140, SCREEN_HEIGHT * 0.18),
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    };

    const onHide = () => {
      setKeyboardVisible(false);
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1.02,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(logoTranslateY, {
          toValue: -Math.min(60, SCREEN_HEIGHT * 0.06),
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [logoOpacity, logoScale, logoTranslateY]);

  // input focus/blur (thêm hành vi khi focus)
  const onFocusInput = () => {
    setIsFocused(true);
    // nếu keyboard đã visible thì keyboard listener sẽ handle việc đẩy logo
    if (!keyboardVisible) {
      Animated.parallel([
        Animated.timing(logoScale, {
          toValue: 0.92,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(logoTranslateY, {
          toValue: -Math.min(110, SCREEN_HEIGHT * 0.12),
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const onBlurInput = () => {
    setIsFocused(false);
    if (!keyboardVisible) {
      Animated.parallel([
        Animated.timing(logoScale, {
          toValue: 1.02,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(logoTranslateY, {
          toValue: -Math.min(60, SCREEN_HEIGHT * 0.06),
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const submit = async () => {
    if (!username || !password) {
      return Alert.alert('Thiếu thông tin', 'Nhập tài khoản và mật khẩu');
    }
    try {
      setLoading(true);
      await login(username, password);
      router.replace('/(tabs)/add_customer');
    } catch (e: any) {
      Alert.alert('Đăng nhập thất bại', e?.message || 'Không thể đăng nhập');
    } finally {
      setLoading(false);
    }
  };

  // include safe inset in keyboard offset so iOS pushes content correctly
  const keyboardVerticalOffset = Platform.OS === 'ios' ? insets.top + 70 : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={styles.container}
      >
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={{ flex: 1 }}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.logoWrapper,
                {
                  top: baseLogoTop,
                  opacity: logoOpacity,
                  transform: [{ translateY: logoTranslateY }, { scale: logoScale }],
                  // khi keyboard visible thì hạ zIndex để form lên trên; ngược lại logo đứng trên
                  zIndex: keyboardVisible ? 1 : 6,
                },
              ]}
            >
              <Image
                source={require('@/assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </Animated.View>

            <ScrollView
              contentContainerStyle={[
                styles.scrollContent,
                { justifyContent: keyboardVisible ? 'flex-start' : 'center' },
              ]}
              keyboardShouldPersistTaps="handled"
            >
              <Animated.View
                style={[
                  styles.formContainer,
                  { opacity: formOpacity, zIndex: 10 }, // ensure form above logo
                ]}
              >
                <Text style={styles.title}>Đăng nhập</Text>

                <TextInput
                  style={[styles.input, isFocused && styles.inputFocused]}
                  placeholder="Tên đăng nhập"
                  placeholderTextColor="#97a3b3"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={username}
                  onChangeText={setUsername}
                  onFocus={onFocusInput}
                  onBlur={onBlurInput}
                  returnKeyType="next"
                  blurOnSubmit={false}
                />

                <TextInput
                  style={[styles.input, styles.inputMarginBottom, isFocused && styles.inputFocused]}
                  placeholder="Mật khẩu"
                  placeholderTextColor="#97a3b3"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  onFocus={onFocusInput}
                  onBlur={onBlurInput}
                  returnKeyType="done"
                  onSubmitEditing={submit}
                />

                <View style={styles.buttonGlowWrapper}>
                  <View style={styles.buttonGlow} />
                  <TouchableOpacity
                    style={[styles.button, loading && { opacity: 0.7 }]}
                    disabled={loading}
                    onPress={submit}
                    activeOpacity={0.9}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Đăng nhập</Text>}
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const GOLD = '#d29b1f';
const GOLD_DEEP = '#b88418';

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  // logo (top handled inline so we can use safe-area top)
  logoWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // zIndex controlled inline depending keyboard visibility
  },
  logo: {
    width: 150,
    height: 150,
    shadowColor: GOLD_DEEP,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 10,
  },

  // ScrollView content
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 40,
    paddingBottom: 40,
  },

  formContainer: {
    alignSelf: 'stretch',
    zIndex: 10, // ensure form above logo
    marginTop: 100 // thêm nếu cần đẩy form xuống
  },

  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 18,
    color: '#0f172a',
  },

  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e6e9ef',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0.3 },
        shadowOpacity: 0.03,
        shadowRadius: 1,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  inputFocused: {
    borderColor: GOLD_DEEP,
  },
  inputMarginBottom: {
    marginBottom: 6,
  },

  buttonGlowWrapper: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGlow: {
    position: 'absolute',
    width: '100%',
    height: 56,
    borderRadius: 12,
    backgroundColor: GOLD,
    opacity: 0.16,
    transform: [{ scaleX: 1.02 }, { scaleY: 1.06 }],
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  button: {
    width: '100%',
    backgroundColor: GOLD,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
