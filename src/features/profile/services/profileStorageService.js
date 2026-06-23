import { STORAGE_KEYS } from '../../../constants/storage';
import {
  readStringStorage,
  removeStorageKeys,
  writeStringStorage,
} from '../../../services/appStorageService';

export const loadProfileData = async () => {
  const [name, email, profileImage] = await Promise.all([
    readStringStorage(STORAGE_KEYS.PROFILE_NAME, ''),
    readStringStorage(STORAGE_KEYS.PROFILE_EMAIL, ''),
    readStringStorage(STORAGE_KEYS.PROFILE_IMAGE, ''),
  ]);

  return {
    name,
    email,
    profileImage,
  };
};

export const saveProfileData = async ({ name, email, profileImage }) => {
  await Promise.all([
    writeStringStorage(STORAGE_KEYS.PROFILE_NAME, name),
    writeStringStorage(STORAGE_KEYS.PROFILE_EMAIL, email),
    writeStringStorage(STORAGE_KEYS.PROFILE_IMAGE, profileImage || ''),
    // A senha não é mais guardada no perfil (era texto puro e não autenticava nada).
    removeStorageKeys([STORAGE_KEYS.PROFILE_PASSWORD]),
  ]);
};
