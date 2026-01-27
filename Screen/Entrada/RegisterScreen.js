import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Animated,
  Keyboard,
  SafeAreaView,
  Dimensions,
} from "react-native";
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import authService from '../../services/authService';
import { CORESREGISTER } from '../../assets/cores/coresAuth';

const { width, height } = Dimensions.get('window');

const COLORS = CORESREGISTER;

const RegisterScreen = ({ navigation, isDarkMode }) => {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [secureText, setSecureText] = useState(true);
  const [secureConfirmText, setSecureConfirmText] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [pressedButton, setPressedButton] = useState(false);

  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    startAnimations();
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

  const validateFields = () => {
    let isValid = true;

    if (!name.trim()) {
      setNameError("Nome é obrigatório");
      isValid = false;
    }

    if (!email.trim() || !validateEmail(email.trim())) {
      setEmailError("Email inválido");
      isValid = false;
    }

    if (!password.trim() || password.length < 6) {
      setPasswordError("Senha deve ter no mínimo 6 caracteres");
      isValid = false;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError("As senhas não coincidem");
      isValid = false;
    }

    return isValid;
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleRegister = async () => {
    Keyboard.dismiss();
    
    if (!validateFields()) return;

    setIsLoading(true);

    try {
      const response = await authService.register(name, email, password);
      
      if (response.status === 201 || response.status === 200) {
        Toast.show({
          type: 'success',
          text1: 'Sucesso!',
          text2: 'Cadastro realizado com sucesso',
        });
        navigation.navigate("LoginScreen");
      }
    } catch (error) {
      shakeForm();
      Toast.show({
        type: 'error',
        text1: 'Erro no Cadastro',
        text2: error.response?.data?.message || 'Erro ao criar conta',
      });
    } finally {
      setIsLoading(false);
    }
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: COLORS.fundo }]}>
      <View style={styles.background}>
        <View style={styles.centeredContent}>
            <Animated.View style={styles.header}>
              <Image
                source={require("../../assets/Image/LOGOCOMFRASE.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <View style={styles.welcomeContainer}>
                <Text style={[styles.subtitleText, { color: COLORS.textoSecundario }]}>
                  Crie sua conta para começar
                </Text>
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
              {/* Campo Nome */}
              <View style={styles.inputWrapper}>
                <View style={[
                  styles.inputContainer, 
                  { 
                    backgroundColor: COLORS.fundo,
                    borderColor: nameError ? COLORS.erro : COLORS.borda,
                  }
                ]}>
                  <MaterialIcons 
                    name="person" 
                    size={22} 
                    color={nameError ? COLORS.erro : COLORS.destaqueAzul} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={[
                      styles.input,
                      { color: COLORS.textoPrincipal }
                    ]}
                    placeholder="Nome completo"
                    placeholderTextColor={COLORS.placeholder}
                    value={name}
                    onChangeText={(text) => {
                      setName(text);
                      setNameError("");
                    }}
                    autoCapitalize="words"
                  />
                </View>
                {nameError ? (
                  <View style={styles.errorContainer}>
                    <MaterialIcons name="error" size={16} color={COLORS.erro} />
                    <Text style={styles.errorText}>{nameError}</Text>
                  </View>
                ) : null}
              </View>

              {/* Campo Email */}
              <View style={styles.inputWrapper}>
                <View style={[
                  styles.inputContainer, 
                  { 
                    backgroundColor: COLORS.fundo,
                    borderColor: emailError ? COLORS.erro : COLORS.borda,
                  }
                ]}>
                  <MaterialIcons 
                    name="email" 
                    size={22} 
                    color={emailError ? COLORS.erro : COLORS.destaqueAzul} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={[
                      styles.input,
                      { color: COLORS.textoPrincipal }
                    ]}
                    placeholder="Digite seu email"
                    placeholderTextColor={COLORS.placeholder}
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
                    <MaterialIcons name="error" size={16} color={COLORS.erro} />
                    <Text style={styles.errorText}>{emailError}</Text>
                  </View>
                ) : null}
              </View>

              {/* Campo Senha */}
              <View style={styles.inputWrapper}>
                <View style={[
                  styles.inputContainer, 
                  { 
                    backgroundColor: COLORS.fundo,
                    borderColor: passwordError ? COLORS.erro : COLORS.borda,
                  }
                ]}>
                  <MaterialIcons 
                    name="lock" 
                    size={22} 
                    color={passwordError ? COLORS.erro : COLORS.destaqueAzul} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={[
                      styles.input,
                      { color: COLORS.textoPrincipal }
                    ]}
                    placeholder="Digite sua senha"
                    placeholderTextColor={COLORS.placeholder}
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
                      color={COLORS.textoSecundario}
                    />
                  </TouchableOpacity>
                </View>
                {passwordError ? (
                  <View style={styles.errorContainer}>
                    <MaterialIcons name="error" size={16} color={COLORS.erro} />
                    <Text style={styles.errorText}>{passwordError}</Text>
                  </View>
                ) : null}
              </View>

              {/* Campo Confirmar Senha */}
              <View style={styles.inputWrapper}>
                <View style={[
                  styles.inputContainer, 
                  { 
                    backgroundColor: COLORS.fundo,
                    borderColor: confirmPasswordError ? COLORS.erro : COLORS.borda,
                  }
                ]}>
                  <MaterialIcons 
                    name="lock-outline" 
                    size={22} 
                    color={confirmPasswordError ? COLORS.erro : COLORS.destaqueAzul} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={[
                      styles.input,
                      { color: COLORS.textoPrincipal }
                    ]}
                    placeholder="Confirme sua senha"
                    placeholderTextColor={COLORS.placeholder}
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      setConfirmPasswordError("");
                    }}
                    secureTextEntry={secureConfirmText}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setSecureConfirmText(!secureConfirmText)}
                  >
                    <MaterialIcons
                      name={secureConfirmText ? "visibility" : "visibility-off"}
                      size={22}
                      color={COLORS.textoSecundario}
                    />
                  </TouchableOpacity>
                </View>
                {confirmPasswordError ? (
                  <View style={styles.errorContainer}>
                    <MaterialIcons name="error" size={16} color={COLORS.erro} />
                    <Text style={styles.errorText}>{confirmPasswordError}</Text>
                  </View>
                ) : null}
              </View>

              {/* Botão de Cadastro */}
              <TouchableOpacity
                style={styles.registerButtonWrapper}
                activeOpacity={0.9}
                onPressIn={() => setPressedButton(true)}
                onPressOut={() => setPressedButton(false)}
                onPress={handleRegister}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={
                    pressedButton
                      ? [COLORS.textoPrincipal, COLORS.textoSecundario]
                      : [COLORS.destaqueAzul, COLORS.textoPrincipal]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.registerButton}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={COLORS.branco} />
                  ) : (
                    <>
                    <MaterialIcons name="person-add" size={20} color={COLORS.branco} />
                      <Text style={styles.registerButtonText}>Cadastrar</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Link para Login */}
              <TouchableOpacity
                style={styles.loginLink}
                onPress={() => navigation.navigate("LoginScreen")}
              >
                <Text style={[
                  styles.loginLinkText,
                { color: COLORS.textoSecundario }
                ]}>
                  Já tem uma conta?{' '}
                  <Text style={styles.loginLinkTextBold}>Faça login</Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  background: {
    flex: 1,
    backgroundColor: COLORS.fundo,
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
  formContainer: {
    backgroundColor: COLORS.cartao,
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
    borderWidth: 1,
    borderColor: COLORS.borda,
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
    color: COLORS.erro,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  registerButtonWrapper: {
    borderRadius: 16,
    shadowColor: COLORS.destaqueAzul,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 24,
  },
  registerButton: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  registerButtonText: {
    color: COLORS.branco,
    fontSize: 18,
    fontWeight: '700',
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  loginLinkText: {
    fontSize: 15,
    fontWeight: '500',
  },
  loginLinkTextBold: {
    color: COLORS.destaqueAzul,
    fontWeight: '700',
  },
});

export default RegisterScreen; 
