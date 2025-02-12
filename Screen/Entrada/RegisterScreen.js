import React, { useState } from "react";
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

const RegisterScreen = ({ navigation }) => {
  // Estados
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

  // Animações
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);
  const shakeAnimation = new Animated.Value(0);

  React.useEffect(() => {
    startAnimations();
  }, []);

  const startAnimations = () => {
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
    <ImageBackground
      source={require('../../assets/Image/FUNDOAPP.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.topSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
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
            <Text style={styles.title}>Criar Conta</Text>
            <Text style={styles.subtitle}>Preencha os dados para se cadastrar</Text>

            {/* Campo Nome */}
            <View style={styles.inputWrapper}>
              <View style={[styles.inputContainer, nameError && styles.inputError]}>
                <Icon name="account" size={20} color="#0367A6" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nome completo"
                  placeholderTextColor="#A0A0A0"
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    setNameError("");
                  }}
                  autoCapitalize="words"
                />
              </View>
              {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
            </View>

            {/* Campo Email */}
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

            {/* Campo Senha */}
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

            {/* Campo Confirmar Senha */}
            <View style={styles.inputWrapper}>
              <View style={[styles.inputContainer, confirmPasswordError && styles.inputError]}>
                <Icon name="lock-check" size={20} color="#0367A6" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirmar senha"
                  placeholderTextColor="#A0A0A0"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setConfirmPasswordError("");
                  }}
                  secureTextEntry={secureConfirmText}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setSecureConfirmText(!secureConfirmText)}
                >
                  <Icon
                    name={secureConfirmText ? "eye" : "eye-off"}
                    size={22}
                    color="#0367A6"
                  />
                </TouchableOpacity>
              </View>
              {confirmPasswordError ? <Text style={styles.errorText}>{confirmPasswordError}</Text> : null}
            </View>

            <TouchableOpacity
              style={styles.registerButton}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.registerButtonText}>Cadastrar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => navigation.navigate("LoginScreen")}
            >
              <Text style={styles.loginLinkText}>
                Já tem uma conta? <Text style={styles.loginLinkTextBold}>Faça login</Text>
              </Text>
            </TouchableOpacity>

          </Animated.View>
        </ScrollView>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  topSection: {
    height: "25%",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 20,
  },
  icon: {
    width: 200,
    height: 250,
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
  registerButton: {
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
  registerButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  eyeIcon: {
    padding: 10,
  },
  loginLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginLinkText: {
    color: "#666",
    fontSize: 16,
  },
  loginLinkTextBold: {
    color: "#0367A6",
    fontWeight: "bold",
  },
});

export default RegisterScreen; 