import { getSupabaseClient } from './supabaseClient';

const PRODUCT_IMAGES_BUCKET = 'product-images';
const signedUrlCache = new Map();

const getFileExtension = (uri = '') => {
  const clean = String(uri).split('?')[0];
  const parts = clean.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : 'jpg';
};

const buildStoragePath = ({ userId, productId, localUri }) => {
  const ext = getFileExtension(localUri);
  return `${userId}/${productId}_${Date.now()}.${ext}`;
};

export const uploadProductImageToSupabase = async ({ userId, productId, localUri }) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Cliente Supabase indisponível');
  }

  if (!userId || !productId || !localUri) {
    throw new Error('Parâmetros inválidos para upload de imagem');
  }

  const storagePath = buildStoragePath({ userId, productId, localUri });
  const response = await fetch(localUri);
  if (!response.ok) {
    throw new Error('Não foi possível ler a imagem local para upload');
  }
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase
    .storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(storagePath, arrayBuffer, {
      upsert: true,
      contentType: `image/${getFileExtension(localUri)}`,
    });

  if (error) {
    throw new Error(error.message || 'Falha ao subir imagem');
  }

  return storagePath;
};

export const getSignedProductImageUrl = async (storagePath, expiresIn = 3600, forceRefresh = false) => {
  const supabase = getSupabaseClient();
  if (!supabase || !storagePath) return null;
  const normalizedPath = String(storagePath);
  const now = Date.now();

  if (!forceRefresh) {
    const cached = signedUrlCache.get(normalizedPath);
    if (cached && cached.expiresAt > now) {
      return cached.url;
    }
  }

  const { data, error } = await supabase
    .storage
    .from(PRODUCT_IMAGES_BUCKET)
    .createSignedUrl(normalizedPath, expiresIn);

  if (error) return null;
  const signedUrl = data?.signedUrl || null;
  if (signedUrl) {
    // guarda em memória por um pouco menos do que o TTL para evitar uso de URL expirada
    signedUrlCache.set(normalizedPath, {
      url: signedUrl,
      expiresAt: now + Math.max(30000, (expiresIn - 60) * 1000),
    });
  }
  return signedUrl;
};
