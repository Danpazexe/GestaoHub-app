import { getSupabaseClient } from './supabaseClient';
import { getSignedProductImageUrl } from './supabaseStorageService';

const TABLE = 'validade_products';

export const getCurrentUserId = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Cliente Supabase indisponível');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) {
    throw new Error('Usuário não autenticado no Supabase');
  }
  return data.user.id;
};

export const listValidadeProducts = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Falha ao listar produtos');
  }

  const mapped = await Promise.all((data || []).map(async (item) => {
    const imagePathValue = String(item.image_path || '');
    const isRemoteUrl = imagePathValue.startsWith('http://') || imagePathValue.startsWith('https://');
    const isStoragePath = Boolean(imagePathValue) && !isRemoteUrl && !imagePathValue.startsWith('file://') && !imagePathValue.startsWith('content://');
    const signedUrl = isStoragePath ? await getSignedProductImageUrl(imagePathValue, 7 * 24 * 3600) : null;

    return {
      id: item.id,
      codprod: item.codprod,
      descricao: item.descricao,
      codauxiliar: item.codauxiliar,
      lote: item.lote,
      validade: item.validade,
      quantidade: item.quantidade,
      diasrestantes: item.diasrestantes,
      imageUrl: signedUrl || (isRemoteUrl ? imagePathValue : null),
      imagePath: isStoragePath ? imagePathValue : null,
      status: item.status,
      treatmentType: item.treatment_type,
      treatmentQuantity: item.treatment_quantity,
      treatmentDate: item.treatment_date,
    };
  }));

  return mapped;
};

export const upsertValidadeProduct = async (product) => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Cliente Supabase indisponível');
  const userId = await getCurrentUserId();

  const payload = {
    id: String(product.id || Date.now().toString()),
    user_id: userId,
    codprod: product.codprod || null,
    descricao: product.descricao || '',
    codauxiliar: product.codauxiliar || null,
    lote: product.lote || null,
    validade: product.validade || null,
    quantidade: Number(product.quantidade || 0),
    diasrestantes: Number.isFinite(product.diasrestantes) ? product.diasrestantes : null,
    image_path: product.imagePath || product.imageUrl || null,
    status: product.status || 'active',
    treatment_type: product.treatmentType || null,
    treatment_quantity: product.treatmentQuantity || null,
    treatment_date: product.treatmentDate || null,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .upsert([payload], { onConflict: 'user_id,id' })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Falha ao salvar produto');
  }

  return data;
};

export const removeValidadeProduct = async (id) => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Cliente Supabase indisponível');
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', String(id))
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message || 'Falha ao remover produto');
  }
};
