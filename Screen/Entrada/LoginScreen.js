// LoginScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ImageBackground,
  ActivityIndicator,
  Animated,
  Keyboard,
  SafeAreaView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import authService from '../../services/authService';

const { width, height } = Dimensions.get('window');

const LoginScreen = ({ navigation, isDarkMode }) => {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [secureText, setSecureText] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [pressedButton, setPressedButton] = useState(false);
  
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);
  const shakeAnimation = new Animated.Value(0);
  const logoScale = new Animated.Value(0.8);

  useEffect(() => {
    const initializeScreen = async () => {
      startAnimations();
      try {
        await loadSavedCredentials();
      } catch (error) {
        console.error('Erro ao carregar credenciais:', error);
      }
    };

    initializeScreen();
  }, []);

  const startAnimations = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    logoScale.setValue(0.8);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadSavedCredentials = async () => {
    try {
      const { savedEmail, savedRememberMe } = await authService.loadSavedCredentials();
      
      if (savedEmail && savedRememberMe === 'true') {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (error) {
      console.error('Erro ao carregar credenciais:', error);
    }
  };

  const saveCredentials = async () => {
    try {
      await authService.saveCredentials(email, rememberMe);
    } catch (error) {
      console.error('Erro ao salvar credenciais:', error);
    }
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    
    if (!validateFields(email, password)) return;

    setIsLoading(true);

    try {
      const response = await authService.login(email, password);
      
      if (response.success || response.status === 200) {
        await handleSuccessfulLogin();
      }
    } catch (error) {
      handleLoginError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateFields = (email, password) => {
    if (!email.trim() || !validateEmail(email.trim())) {
      setEmailError("Email inválido");
      return false;
    }
    if (!password.trim() || password.length < 6) {
      setPasswordError("Senha deve ter no mínimo 6 caracteres");
      return false;
    }
    return true;
  };

  const handleSuccessfulLogin = async () => {
    await saveCredentials();
    const userData = await authService.getUserData();
    Toast.show({
      type: 'success',
      text1: `Bem-vindo, ${userData?.name || 'Usuário'}!`,
      text2: 'Login realizado com sucesso',
    });
    navigation.navigate("HomeScreen");
  };

  const handleLoginError = (error) => {
    shakeForm();
    Toast.show({
      type: 'error',
      text1: 'Erro no Login',
      text2: 'Email ou senha incorretos',
    });
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleRememberMeToggle = () => {
    setRememberMe(!rememberMe);
  };

  const shakeForm = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true
      })
    ]).start();
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]}>
      <ImageBackground
        source={require('../../assets/Image/FUNDOAPP.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={[
            'rgba(255, 255, 255, 0.92)',
            'rgba(240, 248, 255, 0.88)',
            'rgba(245, 247, 250, 0.90)',
            'rgba(255, 255, 255, 0.92)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.centeredContent}>
            <Animated.View style={styles.header}>
              <Image
                source={require("../../assets/Image/LOGOCOMFRASE.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <View style={styles.welcomeContainer}>
                <Text style={[styles.subtitleText, { color: isDarkMode ? '#64748b' : '#64748b' }]}>Faça login para continuar</Text>
              </View>
            </Animated.View>
            <Animated.View 
              style={[
                styles.formContainer,
                {
                  opacity: fadeAnim,
                  transform: [
                    { translateY: slideAnim },
                    { translateX: shakeAnimation }
                  ]
                }
              ]}
            >
              {/* Campo Email */}
              <View style={styles.inputWrapper}>
                <View style={[
                  styles.inputContainer, 
                  { 
                    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                    borderColor: emailError ? '#ef4444' : (isDarkMode ? '#334155' : '#e2e8f0')
                  }
                ]}>
                  <MaterialIcons 
                    name="email" 
                    size={22} 
                    color={emailError ? '#ef4444' : '#3b82f6'} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={[
                      styles.input,
                      { color: isDarkMode ? '#f1f5f9' : '#1e293b' }
                    ]}
                    placeholder="Digite seu email"
                    placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      setEmailError("");
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {emailError ? (
                  <View style={styles.errorContainer}>
                    <MaterialIcons name="error" size={16} color="#ef4444" />
                    <Text style={styles.errorText}>{emailError}</Text>
                  </View>
                ) : null}
              </View>

              {/* Campo Senha */}
              <View style={styles.inputWrapper}>
                <View style={[
                  styles.inputContainer, 
                  { 
                    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                    borderColor: passwordError ? '#ef4444' : (isDarkMode ? '#334155' : '#e2e8f0')
                  }
                ]}>
                  <MaterialIcons 
                    name="lock" 
                    size={22} 
                    color={passwordError ? '#ef4444' : '#3b82f6'} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={[
                      styles.input,
                      { color: isDarkMode ? '#f1f5f9' : '#1e293b' }
                    ]}
                    placeholder="Digite sua senha"
                    placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      setPasswordError("");
                    }}
                    secureTextEntry={secureText}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setSecureText(!secureText)}
                  >
                    <MaterialIcons
                      name={secureText ? "visibility" : "visibility-off"}
                      size={22}
                      color="#64748b"
                    />
                  </TouchableOpacity>
                </View>
                {passwordError ? (
                  <View style={styles.errorContainer}>
                    <MaterialIcons name="error" size={16} color="#ef4444" />
                    <Text style={styles.errorText}>{passwordError}</Text>
                  </View>
                ) : null}
              </View>

              {/* Opções */}
              <View style={styles.optionsContainer}>
                <TouchableOpacity 
                  style={styles.checkboxContainer}
                  onPress={handleRememberMeToggle}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.checkbox,
                    { 
                      backgroundColor: rememberMe ? '#3b82f6' : 'transparent',
                      borderColor: rememberMe ? '#3b82f6' : (isDarkMode ? '#64748b' : '#cbd5e1'),
                    }
                  ]}>
                    {rememberMe && (
                      <MaterialIcons name="check" size={16} color="#ffffff" />
                    )}
                  </View>
                  <Text style={[
                    styles.checkboxText,
                    { color: isDarkMode ? '#cbd5e1' : '#475569' }
                  ]}>
                    Lembrar-me
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Botão de Login */}
              <TouchableOpacity
                style={styles.loginButtonWrapper}
                activeOpacity={0.9}
                onPressIn={() => setPressedButton(true)}
                onPressOut={() => setPressedButton(false)}
                onPress={handleLogin}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={pressedButton ? ['#1d4ed8', '#2563eb'] : ['#2563eb', '#3b82f6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.loginButton}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialIcons name="login" size={20} color="#ffffff" />
                      <Text style={styles.loginButtonText}>Entrar</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Link para Registro */}
              <TouchableOpacity
                style={styles.registerLink}
                onPress={() => navigation.navigate("RegisterScreen")}
              >
                <Text style={[
                  styles.registerLinkText,
                  { color: isDarkMode ? '#94a3b8' : '#64748b' }
                ]}>
                  Não tem uma conta?{' '}
                  <Text style={styles.registerLinkTextBold}>Cadastre-se</Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 280,
    height: 120,
    marginBottom: 16,
    alignSelf: 'center',
  },
  welcomeContainer: {
    alignItems: 'center'
  },
  subtitleText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    marginTop: 8,
    marginBottom: 20,
    width: '100%',
    maxWidth: 400,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    height: 56,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  eyeIcon: {
    padding: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 4,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxText: {
    fontSize: 15,
    fontWeight: '500',
  },
  loginButtonWrapper: {
    borderRadius: 16,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 24,
  },
  loginButton: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  registerLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  registerLinkText: {
    fontSize: 15,
    fontWeight: '500',
  },
  registerLinkTextBold: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  decorativeLine: {
    height: 1,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    marginVertical: 5,
  },
});

export default LoginScreen;
