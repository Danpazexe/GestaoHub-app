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
  Dimensions,
  Modal,
} from "react-native";
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import authService from '../../services/authService';
import { CORESREGISTER } from '../../components/coresAuth';

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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState('');
  const [termsVisible, setTermsVisible] = useState(false);
  const [termsAnchorY, setTermsAnchorY] = useState(0);
  const [privacyAnchorY, setPrivacyAnchorY] = useState(0);
  const termsScrollRef = useRef(null);

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

    if (!termsAccepted) {
      setTermsError('Aceite os termos para continuar');
      isValid = false;
    }

    return isValid;
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleRegister = async () => {
    if (isLoading) return;
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
      const errorMessage =
        error?.data?.message
        || error?.message
        || error?.error_description
        || 'Erro ao criar conta';
      Toast.show({
        type: 'error',
        text1: 'Erro no Cadastro',
        text2: errorMessage,
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

  const openTerms = (section) => {
    setTermsVisible(true);
    setTimeout(() => {
      const y = section === 'privacy' ? privacyAnchorY : termsAnchorY;
      if (termsScrollRef.current && y) {
        termsScrollRef.current.scrollTo({ y, animated: true });
      }
    }, 250);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: COLORS.fundo }]} edges={['top', 'left', 'right']}>
      <View style={styles.background}>
        <View style={styles.centeredContent}>
          <Animated.View style={styles.header}>
            <Image
              source={require("../../../assets/Image/LOGOCOMFRASE.png")}
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
                  color={nameError ? COLORS.erro : COLORS.textoSecundario}
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
                  color={emailError ? COLORS.erro : COLORS.textoSecundario}
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
                  color={passwordError ? COLORS.erro : COLORS.textoSecundario}
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
                  color={confirmPasswordError ? COLORS.erro : COLORS.textoSecundario}
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

            {/* Termos e Privacidade */}
            <TouchableOpacity
              style={styles.termsContainer}
              activeOpacity={0.7}
              onPress={() => {
                setTermsAccepted(!termsAccepted);
                setTermsError('');
              }}
            >
              <View style={[
                styles.termsCheckbox,
                {
                  backgroundColor: termsAccepted ? COLORS.textoPrincipal : 'transparent',
                  borderColor: termsAccepted ? COLORS.textoPrincipal : COLORS.borda,
                }
              ]}>
                {termsAccepted && (
                  <MaterialIcons name="check" size={16} color={COLORS.branco} />
                )}
              </View>
              <Text style={styles.termsText}>
                Li e aceito os{' '}
                <Text style={styles.termsLink} onPress={() => openTerms('terms')}>Termos de Uso</Text>
                {' '}e a{' '}
                <Text style={styles.termsLink} onPress={() => openTerms('privacy')}>Política de Privacidade</Text>
              </Text>
            </TouchableOpacity>
            {termsError ? (
              <Text style={styles.termsError}>{termsError}</Text>
            ) : null}

            {/* Botão de Cadastro */}
            <TouchableOpacity
              style={[
                styles.registerButton,
                pressedButton && styles.registerButtonPressed,
              ]}
              activeOpacity={0.9}
              onPressIn={() => setPressedButton(true)}
              onPressOut={() => setPressedButton(false)}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.branco} />
              ) : (
                <>
                  <MaterialIcons name="person-add" size={20} color={COLORS.branco} />
                  <Text style={styles.registerButtonText}>Cadastrar</Text>
                </>
              )}
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
      <Modal
        visible={termsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTermsVisible(false)}
      >
        <View style={styles.termsModalOverlay}>
          <View style={styles.termsModalCard}>
            <View style={styles.termsModalHeader}>
              <Text style={styles.termsModalTitle}>Termos e Privacidade</Text>
              <TouchableOpacity onPress={() => setTermsVisible(false)}>
                <MaterialIcons name="close" size={22} color={COLORS.textoSecundario} />
              </TouchableOpacity>
            </View>
            <ScrollView ref={termsScrollRef} showsVerticalScrollIndicator={false}>
              <Text
                style={styles.termsSectionTitle}
                onLayout={(e) => setTermsAnchorY(e.nativeEvent.layout.y)}
              >
                Termos de Uso
              </Text>
              <Text style={styles.termsSectionText}>
                Ao criar sua conta, você concorda em utilizar o aplicativo de forma responsável,
                respeitando as políticas internas e a legislação vigente. Você é responsável pelas
                informações cadastradas e pela segurança do seu acesso.
              </Text>
              <Text style={styles.termsSectionText}>
                É proibido utilizar o aplicativo para fins ilícitos, inserir dados falsos ou
                comprometer o funcionamento do sistema. Podemos suspender ou encerrar contas que
                violem estes termos.
              </Text>

              <Text
                style={styles.termsSectionTitle}
                onLayout={(e) => setPrivacyAnchorY(e.nativeEvent.layout.y)}
              >
                Política de Privacidade
              </Text>
              <Text style={styles.termsSectionText}>
                Coletamos apenas os dados necessários para o funcionamento do aplicativo, como nome,
                e-mail e informações de produtos cadastrados. Seus dados não são vendidos a terceiros.
              </Text>
              <Text style={styles.termsSectionText}>
                Você pode solicitar a atualização ou exclusão dos seus dados a qualquer momento.
                Utilizamos medidas de segurança para proteger suas informações.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    marginBottom: 14,
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
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  termsCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  termsText: {
    fontSize: 13,
    color: COLORS.textoSecundario,
    lineHeight: 18,
    marginRight: 4,
  },
  termsLink: {
    color: COLORS.destaqueDourado,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  termsError: {
    color: COLORS.erro,
    fontSize: 12,
    marginBottom: 12,
    marginLeft: 32,
  },
  termsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  termsModalCard: {
    backgroundColor: COLORS.cartao,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    maxHeight: '75%',
  },
  termsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  termsModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textoPrincipal,
  },
  termsSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textoPrincipal,
    marginTop: 8,
    marginBottom: 6,
  },
  termsSectionText: {
    fontSize: 13,
    color: COLORS.textoSecundario,
    lineHeight: 18,
    marginBottom: 10,
  },
  registerButton: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.textoPrincipal,
    marginBottom: 24,
  },
  registerButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
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
    color: COLORS.destaqueDourado,
    fontWeight: '700',
  },
});

export default RegisterScreen; 
