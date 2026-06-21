export const SUPABASE_CONFIG = {
  url: 'https://bucftvtvcvozpasokgxp.supabase.co',
  anonKey: 'sb_publishable_vGP_IZI5PfwzBL1QezdIdQ_dI9t8Uc8',

  // LEGADO/DEV: nome de uma tabela KV (app_storage_kv) usada apenas pelo
  // health-check do painel de diagnóstico (EasterEggScreen). NÃO é caminho de
  // sincronização — a sincronização real é feita por tabela tipada em cada
  // serviço (validade, avaria, conferência, tratativas, settings, presença).
  // O antigo bridge que espelhava todo o AsyncStorage aqui foi removido.
  storageTable: 'app_storage_kv',
};
