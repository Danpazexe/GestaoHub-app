import { getActiveSessionId } from './presenceService';
import { getSupabaseClient } from './supabaseClient';
import { readStoredUserName } from './userSessionStorageService';
import { getCurrentUserId } from './validadeSupabaseService';

// Registra um evento operacional para a trilha de auditoria do painel admin.
// Best-effort e fire-and-forget: nunca lança e nunca bloqueia o fluxo do app.
export const logEvent = async ({
  module,
  eventType,
  entityType = null,
  entityId = null,
  orderRef = null,
  batchRef = null,
  payload = {},
}) => {
  const supabase = getSupabaseClient();
  if (!supabase || !module || !eventType) return;

  let userId = null;
  try {
    userId = await getCurrentUserId();
  } catch {
    return; // sem usuário autenticado (dev user / pré-login) → não audita
  }
  if (!userId) return;

  let actorName = null;
  try {
    actorName = await readStoredUserName(null);
  } catch {
    actorName = null;
  }

  try {
    await supabase.from('operational_events').insert([
      {
        user_id: userId,
        session_id: getActiveSessionId(),
        module,
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId != null ? String(entityId) : null,
        order_ref: orderRef,
        batch_ref: batchRef,
        actor_name: actorName,
        payload: payload || {},
      },
    ]);
  } catch (error) {
    console.warn('[events] Falha ao registrar evento operacional.', error?.message || error);
  }
};
