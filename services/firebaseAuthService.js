import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, updateProfile, getIdToken } from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

class FirebaseAuthService {
  constructor() {
    this.auth = getAuth();
    this.setupAuthStateListener();
  }

  setupAuthStateListener() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        const userData = {
          id: user.uid,
          name: user.displayName || user.email,
          email: user.email,
          photoURL: user.photoURL
        };
        await AsyncStorage.setItem('userData', JSON.stringify(userData));
      } else {
        await AsyncStorage.removeItem('userData');
      }
    });
  }

  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email.trim(), password);
      const user = userCredential.user;
      
      const userData = {
        id: user.uid,
        name: user.displayName || user.email,
        email: user.email,
        photoURL: user.photoURL
      };

      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      
      return { 
        data: { user: userData, token: await getIdToken(user) }, 
        status: 200, 
        success: true 
      };
    } catch (error) {
      let errorMessage = 'Erro ao fazer login';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Usuário não encontrado';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Senha incorreta';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Email inválido';
          break;
        case 'auth/user-disabled':
          errorMessage = 'Usuário desabilitado';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Muitas tentativas. Tente novamente mais tarde';
          break;
        default:
          errorMessage = error.message;
      }
      
      throw { message: errorMessage, code: error.code };
    }
  }

  async register(name, email, password) {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email.trim(), password);
      const user = userCredential.user;
      
      await updateProfile(user, {
        displayName: name.trim()
      });
      
      const userData = {
        id: user.uid,
        name: name.trim(),
        email: user.email,
        photoURL: user.photoURL
      };

      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      
      return { 
        data: { user: userData, token: await getIdToken(user) }, 
        status: 200, 
        success: true 
      };
    } catch (error) {
      let errorMessage = 'Erro ao criar conta';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Email já está em uso';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Email inválido';
          break;
        case 'auth/weak-password':
          errorMessage = 'Senha muito fraca';
          break;
        default:
          errorMessage = error.message;
      }
      
      throw { message: errorMessage, code: error.code };
    }
  }

  async logout() {
    try {
      await signOut(this.auth);
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.multiRemove(['savedEmail', 'rememberMe']);
      return { success: true };
    } catch (error) {
      throw { message: 'Erro ao fazer logout', code: error.code };
    }
  }

  async getCurrentUser() {
    const user = this.auth.currentUser;
    if (user) {
      return {
        id: user.uid,
        name: user.displayName || user.email,
        email: user.email,
        photoURL: user.photoURL
      };
    }
    return null;
  }

  async getUserData() {
    const userData = await AsyncStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
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

  async resetPassword(email) {
    try {
      await sendPasswordResetEmail(this.auth, email.trim());
      return { success: true, message: 'Email de redefinição enviado' };
    } catch (error) {
      let errorMessage = 'Erro ao enviar email de redefinição';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Usuário não encontrado';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Email inválido';
          break;
        default:
          errorMessage = error.message;
      }
      
      throw { message: errorMessage, code: error.code };
    }
  }

  async updateProfile(displayName, photoURL) {
    try {
      const user = this.auth.currentUser;
      if (user) {
        await updateProfile(user, {
          displayName,
          photoURL
        });
        
        const userData = {
          id: user.uid,
          name: displayName || user.email,
          email: user.email,
          photoURL: photoURL || user.photoURL
        };
        
        await AsyncStorage.setItem('userData', JSON.stringify(userData));
        return { success: true };
      }
      throw { message: 'Usuário não autenticado' };
    } catch (error) {
      throw { message: 'Erro ao atualizar perfil', code: error.code };
    }
  }
}

export default new FirebaseAuthService(); 