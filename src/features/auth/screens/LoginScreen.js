// LoginScreen.js
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Animated,
  Keyboard,
} from "react-native";
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import authService from '../../../services/authService';
import { CORESLOGIN } from '../../../components/coresAuth';
import KeyboardAwareScreen from '../../../components/KeyboardAwareScreen';
import haptics from '../../../utils/haptics';

const COLORS = CORESLOGIN;

const LoginScreen = ({ navigation, isDarkMode }) => {
  const palette = {
    // Superfícies
    fundo: isDarkMode ? COLORS.fundoDark : COLORS.fundo,
    cartao: isDarkMode ? COLORS.cartaoDark : COLORS.cartao,
    input: isDarkMode ? COLORS.inputDark : COLORS.fundo,
    borda: isDarkMode ? COLORS.bordaDark : COLORS.borda,
    // Textos
    textoPrincipal: isDarkMode ? COLORS.textoPrincipalDark : COLORS.textoPrincipal,
    textoSecundario: isDarkMode ? COLORS.textoSecundarioDark : COLORS.textoSecundario,
    placeholder: isDarkMode ? COLORS.placeholderDark : COLORS.placeholder,
    // Botão primário: indigo mais claro/nítido no dark p/ manter contraste sobre fundo escuro
    botaoPrimario: isDarkMode ? '#4a5599' : COLORS.textoPrincipal,
    // Checkbox marcado acompanha o botão primário
    destaque: isDarkMode ? '#4a5599' : COLORS.textoPrincipal,
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [secureText, setSecureText] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [pressedButton, setPressedButton] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const initializeView = async () => {
      startAnimations();
      try {
        await loadSavedCredentials();
      } catch (error) {
        console.error('Erro ao carregar credenciais:', error);
      }
    };

    initializeView();
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

      if (savedRememberMe === 'true') {
        setEmail(savedEmail);
        // A senha não é mais pré-preenchida (não é guardada em texto puro).
        setRememberMe(true);
      }
    } catch (error) {
      console.error('Erro ao carregar credenciais:', error);
    }
  };

  const saveCredentials = async (targetEmail, targetPassword, shouldRememberCredentials) => {
    try {
      await authService.saveCredentials(
        targetEmail,
        targetPassword,
        shouldRememberCredentials,
      );
    } catch (error) {
      console.error('Erro ao salvar credenciais:', error);
    }
  };

  const performLogin = async (targetEmail, targetPassword) => {
    Keyboard.dismiss();

    if (!validateFields(targetEmail, targetPassword)) return;

    const shouldRememberCredentials = rememberMe;
    setIsLoading(true);

    try {
      const response = await authService.login(targetEmail, targetPassword);

      if (response.success || response.status === 200) {
        await handleSuccessfulLogin(
          targetEmail,
          targetPassword,
          shouldRememberCredentials,
        );
      }
    } catch (error) {
      handleLoginError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    await performLogin(email, password);
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

  const handleSuccessfulLogin = async (
    targetEmail,
    targetPassword,
    shouldRememberCredentials,
  ) => {
    await saveCredentials(targetEmail, targetPassword, shouldRememberCredentials);
    const userData = await authService.getUserData();
    haptics.success();
    Toast.show({
      type: 'success',
      text1: `Bem-vindo, ${userData?.name || 'Usuário'}!`,
      text2: 'Login realizado com sucesso',
    });
    navigation.navigate("HomeScreen");
  };

  const handleLoginError = (error) => {
    haptics.error();
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

  const handleRememberMeToggle = async () => {
    const nextRememberMe = !rememberMe;
    setRememberMe(nextRememberMe);

    if (!nextRememberMe) {
      await saveCredentials(email, password, false);
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.fundo }]} edges={['top', 'left', 'right']}>
      <KeyboardAwareScreen>
      <View style={[styles.background, { backgroundColor: palette.fundo }]}>
        <View style={styles.centeredContent}>
          <Animated.View style={styles.header}>
            <Animated.View style={{ transform: [{ scale: logoScale }] }}>
              <Image
                source={require("../../../../assets/Image/LOGOCOMFRASE.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </Animated.View>
            <View style={styles.welcomeContainer}>
              <Text style={[styles.subtitleText, { color: palette.textoSecundario }]}>
                Faça login para continuar
              </Text>
            </View>
          </Animated.View>
          <Animated.View
            style={[
              styles.formContainer,
              {
                backgroundColor: palette.cartao,
                borderColor: palette.borda,
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
                  backgroundColor: palette.input,
                  borderColor: emailError ? COLORS.erro : palette.borda,
                }
              ]}>
                <MaterialIcons
                  name="email"
                  size={22}
                  color={emailError ? COLORS.erro : palette.textoSecundario}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    styles.input,
                    { color: palette.textoPrincipal }
                  ]}
                  placeholder="Digite seu email"
                  placeholderTextColor={palette.placeholder}
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
                  backgroundColor: palette.input,
                  borderColor: passwordError ? COLORS.erro : palette.borda,
                }
              ]}>
                <MaterialIcons
                  name="lock"
                  size={22}
                  color={passwordError ? COLORS.erro : palette.textoSecundario}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    styles.input,
                    { color: palette.textoPrincipal }
                  ]}
                  placeholder="Digite sua senha"
                  placeholderTextColor={palette.placeholder}
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
                    color={palette.textoSecundario}
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
                    backgroundColor: rememberMe ? palette.destaque : 'transparent',
                    borderColor: rememberMe ? palette.destaque : palette.borda,
                  }
                ]}>
                  {rememberMe && (
                    <MaterialIcons name="check" size={16} color={COLORS.branco} />
                  )}
                </View>
                <Text style={[
                  styles.checkboxText,
                  { color: palette.textoPrincipal }
                ]}>
                  Lembrar-me
                </Text>
              </TouchableOpacity>
            </View>

            {/* Botão de Login */}
            <TouchableOpacity
              style={[
                styles.loginButton,
                { backgroundColor: palette.botaoPrimario },
                pressedButton && styles.loginButtonPressed,
              ]}
              activeOpacity={0.9}
              onPressIn={() => setPressedButton(true)}
              onPressOut={() => setPressedButton(false)}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.branco} />
              ) : (
                <>
                  <MaterialIcons name="login" size={20} color={COLORS.branco} />
                  <Text style={styles.loginButtonText}>Entrar</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Link para Registro */}
            <TouchableOpacity
              style={styles.registerLink}
              onPress={() => navigation.navigate("RegisterScreen")}
            >
              <Text style={[
                styles.registerLinkText,
                { color: palette.textoSecundario }
              ]}>
                Não tem uma conta?{' '}
                <Text style={styles.registerLinkTextBold}>Cadastre-se</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
      </KeyboardAwareScreen>
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
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    marginTop: 6,
    marginBottom: 12,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: COLORS.borda,
  },
  inputWrapper: {
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    height: 56,
    paddingHorizontal: 16,
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
  optionsContainer: {
    marginBottom: 2,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
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
  loginButton: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.textoPrincipal,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  loginButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  loginButtonText: {
    color: COLORS.branco,
    fontSize: 18,
    fontWeight: '700',
  },
  registerLink: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 2,
  },
  registerLinkText: {
    fontSize: 15,
    fontWeight: '500',
  },
  registerLinkTextBold: {
    color: COLORS.destaqueDourado,
    fontWeight: '700',
  },
});

export default LoginScreen;
