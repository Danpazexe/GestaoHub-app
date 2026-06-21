-- =============================================
-- Gestão Hub - Promover primeiro admin
-- =============================================
-- Pré-requisito: o usuário já fez signup (no app ou na web), o que cria
-- a linha em auth.users e, via trigger, em public.profiles.
--
-- Rode DEPOIS de schema_app_v1.sql e schema_admin_panel_v1.sql.
-- Troque o e-mail abaixo pelo do seu usuário admin.

insert into public.admin_users (user_id, role)
select p.user_id, 'admin'
from public.profiles p
where p.email = 'troque-aqui@exemplo.com'
on conflict (user_id) do update
  set role = 'admin',
      updated_at = now();

-- Conferência: deve retornar a linha do admin recém-promovido.
select au.user_id, au.role, p.email, p.name
from public.admin_users au
join public.profiles p on p.user_id = au.user_id;
