import ReactNativeBlobUtil from 'react-native-blob-util';

export const isLocalImageUri = (uri) => {
  if (!uri) return false;
  const value = String(uri);
  return value.startsWith('file://') || value.startsWith('content://') || value.startsWith('/');
};

const getFileExtension = (uri = '') => {
  const cleanUri = String(uri).split('?')[0];
  const segments = cleanUri.split('.');
  return segments.length > 1 ? segments.pop().toLowerCase() : 'jpg';
};

export const persistImageToAppStorage = async (uri) => {
  if (!isLocalImageUri(uri)) return uri;

  try {
    const documentDir = ReactNativeBlobUtil.fs.dirs.DocumentDir;
    const imagesDir = `${documentDir}/gestao_images`;
    const sourcePath = String(uri).startsWith('file://') ? String(uri).replace('file://', '') : String(uri);
    const extension = getFileExtension(uri);
    const destinationPath = `${imagesDir}/${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`;

    const dirExists = await ReactNativeBlobUtil.fs.exists(imagesDir);
    if (!dirExists) {
      await ReactNativeBlobUtil.fs.mkdir(imagesDir);
    }

    await ReactNativeBlobUtil.fs.cp(sourcePath, destinationPath);
    return `file://${destinationPath}`;
  } catch (error) {
    console.warn('Falha ao persistir imagem localmente. Usando URI original.', error?.message || error);
    return uri;
  }
};
