import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

class AuthService {
  async login(email, password) {
    // Verificar credenciais fixas primeiro
    if (email.trim() === 'admin@gmail.com' && password === '123456') {
      const adminUser = {
        user: {
          id: 1,
          name: 'Administrador',
          email: 'admin@gmail.com'
        },
        token: 'admin-token'
      };
      
      await AsyncStorage.setItem('userData', JSON.stringify(adminUser.user));
      return { data: adminUser, status: 200, success: true };
    }

    // login com API
    const response = await axios.post(
      "https://api.gestao.aviait.com.br/sessions",
      {
        email: email.trim(),
        password: password.trim(),
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (response.data.user) {
      await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
    }

    return response;
  }

  async saveCredentials(email, rememberMe) {
    if (rememberMe) {
      await AsyncStorage.setItem('savedEmail', email);
      await AsyncStorage.setItem('rememberMe', 'true');
    } else {
      await AsyncStorage.multiRemove(['savedEmail', 'rememberMe']);
    }
  }

  async loadSavedCredentials() {
    const savedEmail = await AsyncStorage.getItem('savedEmail');
    const savedRememberMe = await AsyncStorage.getItem('rememberMe');
    return { savedEmail, savedRememberMe };
  }

  async getUserData() {
    const userData = await AsyncStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  }

  async register(name, email, password) {
    const response = await axios.post(
      "https://api.gestao.aviait.com.br/users",
      {
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (response.data.user) {
      await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
    }

    return response;
  }
}

export default new AuthService();