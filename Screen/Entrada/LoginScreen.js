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
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import Toast from 'react-native-toast-message';
import authService from '../../services/authService';



const LoginScreen = ({ navigation }) => {
  const [mounted, setMounted] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [secureText, setSecureText] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);
  const shakeAnimation = new Animated.Value(0);

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

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start((finished) => {
      if (!finished) {
        fadeAnim.setValue(1);
        slideAnim.setValue(0);
      }
    });
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
    <View style={styles.container}>
      <ImageBackground
        source={require('../../assets/Image/FUNDOAPP.png')}
        style={styles.container}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <Animated.View 
            style={[styles.topSection, {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }]}
          >
            <Image
              source={require("../../assets/Image/LOGOCOMFRASE.png")}
              style={styles.icon}
            />
          </Animated.View>

          <ScrollView 
            contentContainerStyle={styles.formContainer}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View 
              style={[
                styles.formBox,
                {
                  opacity: fadeAnim,
                  transform: [
                    { translateY: slideAnim },
                    { translateX: shakeAnimation }
                  ]
                }
              ]}
            >
              <Text style={styles.title}>Bem-vindo</Text>
              <Text style={styles.subtitle}>Faça login para continuar</Text>

              <View style={styles.inputWrapper}>
                <View style={[styles.inputContainer, emailError && styles.inputError]}>
                  <Icon name="email" size={20} color="#0367A6" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#A0A0A0"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      setEmailError("");
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
              </View>

              <View style={styles.inputWrapper}>
                <View style={[styles.inputContainer, passwordError && styles.inputError]}>
                  <Icon name="lock" size={20} color="#0367A6" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Senha"
                    placeholderTextColor="#A0A0A0"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      setPasswordError("");
                    }}
                    secureTextEntry={secureText}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setSecureText(!secureText)}
                  >
                    <Icon
                      name={secureText ? "eye" : "eye-off"}
                      size={22}
                      color="#0367A6"
                    />
                  </TouchableOpacity>
                </View>
                {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
              </View>

              <View style={styles.optionsContainer}>
                <TouchableOpacity 
                  style={styles.checkboxContainer}
                  onPress={() => setRememberMe(!rememberMe)}
                >
                  <Icon
                    name={rememberMe ? "checkbox-marked" : "checkbox-blank-outline"}
                    size={24}
                    color="#0367A6"
                  />
                  <Text style={styles.checkboxText}>Lembrar-me</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>Entrar</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.registerLink}
                onPress={() => navigation.navigate("RegisterScreen")}
              >
                <Text style={styles.registerLinkText}>
                  Não tem uma conta? <Text style={styles.registerLinkTextBold}>Cadastre-se</Text>
                </Text>
              </TouchableOpacity>

            </Animated.View>
          </ScrollView>
        </View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingTop: 20,
  },
  topSection: {
    height: "35%",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 30,
  },
  icon: {
    width: 300,
    height: 350,
    resizeMode: "contain",
  },
  formContainer: {
    flexGrow: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  formBox: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#0367A6",
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 30,
    textAlign: 'center',
  },
  inputWrapper: {
    marginBottom: 15,
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    backgroundColor: "#F8F9FA",
    height: 55,
  },
  inputIcon: {
    marginLeft: 15,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#000000",
    paddingRight: 15,
  },
  inputError: {
    borderColor: "#FF0000",
    borderWidth: 1.5,
  },
  errorText: {
    color: "#FF0000",
    fontSize: 14,
    marginTop: 5,
    marginLeft: 10,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0367A6',
  },
  checkboxText: {
    marginLeft: 8,
    color: "#666",
    fontSize: 14,
  },
  loginButton: {
    height: 55,
    backgroundColor: "#0367A6",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    shadowColor: "#0367A6",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  eyeIcon: {
    padding: 10,
  },
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerLinkText: {
    color: "#666",
    fontSize: 16,
  },
  registerLinkTextBold: {
    color: "#0367A6",
    fontWeight: "bold",
  },
});

export default LoginScreen;
