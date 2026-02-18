import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

class AuthService {
  registerInFlight = false;

  mapAuthErrorMessage(rawMessage, fallbackMessage) {
    const normalized = String(rawMessage || '').toLowerCase();

    if (normalized.includes('email rate limit exceeded')) {
      return 'Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.';
    }

    if (normalized.includes('user already registered') || normalized.includes('already been registered')) {
      return 'Este e-mail já está cadastrado. Faça login ou recupere a senha.';
    }

    if (normalized.includes('invalid email')) {
      return 'O e-mail informado é inválido.';
    }

    if (normalized.includes('password')) {
      return 'A senha não atende aos requisitos mínimos.';
    }

    return rawMessage || fallbackMessage;
  }

  normalizeError(error, fallbackMessage = 'Operacao falhou') {
    const rawMessage =
      error?.data?.message
      || error?.message
      || error?.error_description
      || fallbackMessage;

    const message =
      this.mapAuthErrorMessage(rawMessage, fallbackMessage);

    return {
      status: error?.status || 500,
      data: error?.data || null,
      message,
    };
  }

  async loginWithSupabase(email, password) {
    if (!isSupabaseConfigured()) {
      throw this.normalizeError({}, 'Supabase nao configurado');
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      throw this.normalizeError({}, 'Cliente Supabase indisponivel');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      throw this.normalizeError(error, 'Falha ao autenticar com Supabase');
    }

    const user = data?.user
      ? {
        id: data.user.id,
        name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Usuario',
        email: data.user.email,
      }
      : null;

    if (user) {
      await AsyncStorage.setItem('userData', JSON.stringify(user));
    }

    return { status: 200, data: { user, session: data?.session }, success: true };
  }

  async login(email, password) {
    if (!isSupabaseConfigured()) {
      throw this.normalizeError({}, 'Supabase nao configurado');
    }
    return this.loginWithSupabase(email, password);
  }

  async saveCredentials() {
    await AsyncStorage.multiRemove(['savedEmail', 'rememberMe']);
  }

  async loadSavedCredentials() {
    return { savedEmail: null, savedRememberMe: null };
  }

  async getUserData() {
    const userData = await AsyncStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  }

  async register(name, email, password) {
    if (this.registerInFlight) {
      throw this.normalizeError({}, 'Cadastro em andamento. Aguarde alguns segundos.');
    }

    this.registerInFlight = true;
    try {
    // cadastro principal via Supabase Auth
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw this.normalizeError({}, 'Cliente Supabase indisponivel');
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            name: name.trim(),
          },
        },
      });

      if (error) {
        const normalized = this.normalizeError(error, 'Erro ao criar conta');
        if (String(normalized.message).toLowerCase().includes('muitas tentativas')) {
          try {
            return await this.loginWithSupabase(email, password);
          } catch {
            // mantém erro original amigável
          }
        }
        throw this.normalizeError(error, 'Erro ao criar conta');
      }

      const user = data?.user
        ? {
          id: data.user.id,
          name: data.user.user_metadata?.name || name.trim(),
          email: data.user.email || email.trim(),
        }
        : null;

      if (user) {
        await AsyncStorage.setItem('userData', JSON.stringify(user));
      }

      return {
        status: 201,
        data: {
          user,
          session: data?.session || null,
        },
      };
    }

    throw this.normalizeError({}, 'Supabase nao configurado');
    } finally {
      this.registerInFlight = false;
    }
  }
}

export default new AuthService();
