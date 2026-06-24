import { STORAGE_KEYS } from '../constants/storage';
import {
  readJsonStorage,
  readStringStorage,
  removeStorageKeys,
  writeJsonStorage,
  writeStringStorage,
} from './appStorageService';
import { endPresence } from './presenceService';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { NativeModules } from 'react-native';
import * as Keychain from 'react-native-keychain';

const DEV_USER = {
  id: 'dev-local-user',
  name: 'Dev Gestão',
  email: 'dev@gestaohub.local',
  password: 'dev123456',
};

// Cofre seguro do aparelho para a senha do "Lembrar-me" (Keychain no iOS,
// Keystore no Android). Encapsulado e tolerante a falha.
const KEYCHAIN_SERVICE = 'gestaohub.auth';

// O módulo nativo só existe após um build nativo (pod install + rebuild). Enquanto
// não estiver linkado, RNKeychainManager é null e qualquer chamada quebra — então
// detectamos isso e pulamos as chamadas, avisando UMA vez (sem poluir o console).
const KEYCHAIN_AVAILABLE = !!(NativeModules && NativeModules.RNKeychainManager);
let warnedKeychainUnavailable = false;

function ensureKeychain() {
  if (KEYCHAIN_AVAILABLE) {
    return true;
  }
  if (!warnedKeychainUnavailable) {
    warnedKeychainUnavailable = true;
    console.info('[AuthService] Cofre seguro indisponível (módulo nativo não linkado — requer rebuild). "Lembrar-me" guardará só o e-mail por enquanto.');
  }
  return false;
}

async function saveSecurePassword(email, password) {
  if (!ensureKeychain()) {
    return;
  }
  try {
    if (!password) {
      await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
      return;
    }
    await Keychain.setGenericPassword(email, password, { service: KEYCHAIN_SERVICE });
  } catch (error) {
    console.warn('[AuthService] Falha ao salvar senha no cofre seguro.', error?.message || error);
  }
}

async function loadSecurePassword() {
  if (!ensureKeychain()) {
    return '';
  }
  try {
    const creds = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    return creds && creds.password ? creds.password : '';
  } catch (error) {
    console.warn('[AuthService] Falha ao ler senha do cofre seguro.', error?.message || error);
    return '';
  }
}

async function clearSecurePassword() {
  if (!ensureKeychain()) {
    return;
  }
  try {
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  } catch (error) {
    console.warn('[AuthService] Falha ao limpar senha do cofre seguro.', error?.message || error);
  }
}

class AuthService {
  registerInFlight = false;

  isDevUserEnabled() {
    return typeof __DEV__ !== 'undefined' && __DEV__;
  }

  getDevUserCredentials() {
    if (!this.isDevUserEnabled()) {
      return null;
    }

    return {
      email: DEV_USER.email,
      password: DEV_USER.password,
      name: DEV_USER.name,
    };
  }

  async loginWithDevUser(email, password) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedPassword = String(password || '').trim();

    if (
      !this.isDevUserEnabled()
      || normalizedEmail !== DEV_USER.email
      || normalizedPassword !== DEV_USER.password
    ) {
      return null;
    }

    const user = {
      id: DEV_USER.id,
      name: DEV_USER.name,
      email: DEV_USER.email,
      isDevUser: true,
      authProvider: 'dev-local',
    };

    await writeJsonStorage(STORAGE_KEYS.USER_DATA, user);

    return {
      status: 200,
      data: {
        user,
        session: null,
      },
      success: true,
    };
  }

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
      await writeJsonStorage(STORAGE_KEYS.USER_DATA, user);
    }

    return { status: 200, data: { user, session: data?.session }, success: true };
  }

  async login(email, password) {
    const devResponse = await this.loginWithDevUser(email, password);
    if (devResponse) {
      return devResponse;
    }

    if (!isSupabaseConfigured()) {
      throw this.normalizeError({}, 'Supabase nao configurado');
    }
    return this.loginWithSupabase(email, password);
  }

  async saveCredentials(email, password, rememberMe) {
    if (!rememberMe) {
      await removeStorageKeys([
        STORAGE_KEYS.SAVED_EMAIL,
        STORAGE_KEYS.SAVED_PASSWORD,
        STORAGE_KEYS.REMEMBER_ME,
      ]);
      await clearSecurePassword();
      return;
    }

    await Promise.all([
      writeStringStorage(STORAGE_KEYS.SAVED_EMAIL, String(email || '').trim()),
      writeStringStorage(STORAGE_KEYS.REMEMBER_ME, 'true'),
      // A senha vai para o cofre seguro do aparelho (Keychain/Keystore), nunca em
      // texto puro. Remove resíduo de senha salva por versões anteriores do app.
      removeStorageKeys([STORAGE_KEYS.SAVED_PASSWORD]),
      saveSecurePassword(String(email || '').trim(), String(password || '')),
    ]);
  }

  async loadSavedCredentials() {
    const [savedEmail, savedRememberMe] = await Promise.all([
      readStringStorage(STORAGE_KEYS.SAVED_EMAIL, ''),
      readStringStorage(STORAGE_KEYS.REMEMBER_ME, ''),
    ]);

    const savedPassword = savedRememberMe === 'true' ? await loadSecurePassword() : '';

    return {
      savedEmail,
      savedPassword,
      savedRememberMe,
    };
  }

  async getUserData() {
    return readJsonStorage(STORAGE_KEYS.USER_DATA, null);
  }

  async logout() {
    let remoteSignOutError = null;

    // Encerra a presença ANTES do signOut (depois a RLS bloqueia o update).
    try {
      await endPresence();
    } catch (error) {
      console.warn('[AuthService] Falha ao encerrar presença no logout.', error?.message || error);
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();

      if (supabase?.auth?.signOut) {
        try {
          const { error } = await supabase.auth.signOut();
          if (error) {
            remoteSignOutError = error;
          }
        } catch (error) {
          remoteSignOutError = error;
        }
      }
    }

    await removeStorageKeys([STORAGE_KEYS.USER_DATA]);

    if (remoteSignOutError) {
      console.warn('[AuthService] Logout remoto falhou, mas a sessão local foi encerrada.', remoteSignOutError?.message || remoteSignOutError);
    }

    return { success: true };
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
        await writeJsonStorage(STORAGE_KEYS.USER_DATA, user);
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
