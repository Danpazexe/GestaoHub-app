import { STORAGE_KEYS } from '../../../constants/storage';
import {
  readStringStorage,
  writeStringStorage,
} from '../../../services/appStorageService';

export const loadProfileData = async () => {
  const [name, email, password, profileImage] = await Promise.all([
    readStringStorage(STORAGE_KEYS.PROFILE_NAME, ''),
    readStringStorage(STORAGE_KEYS.PROFILE_EMAIL, ''),
    readStringStorage(STORAGE_KEYS.PROFILE_PASSWORD, ''),
    readStringStorage(STORAGE_KEYS.PROFILE_IMAGE, ''),
  ]);

  return {
    name,
    email,
    password,
    profileImage,
  };
};

export const saveProfileData = async ({ name, email, password, profileImage }) => {
  await Promise.all([
    writeStringStorage(STORAGE_KEYS.PROFILE_NAME, name),
    writeStringStorage(STORAGE_KEYS.PROFILE_EMAIL, email),
    writeStringStorage(STORAGE_KEYS.PROFILE_PASSWORD, password),
    writeStringStorage(STORAGE_KEYS.PROFILE_IMAGE, profileImage || ''),
  ]);
};
