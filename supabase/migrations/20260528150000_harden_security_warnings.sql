-- Cierra los warnings de Security Advisor que son seguros de atacar sin
-- tocar el flujo de booking público (eso queda para una migration aparte).
--
-- Tres bloques:
--   1. SET search_path = public, pg_temp en todas las funciones.
--      Mitiga el vector de search_path injection — particularmente
--      crítico en SECURITY DEFINER, donde un atacante con permisos para
--      crear objetos en un schema cualquiera podría sombrear funciones
--      o tablas que la nuestra invoca por nombre corto.
--
--   2. RLS de las tablas del bot de WhatsApp (bot_sessions, bot_templates).
--      Hoy tienen `USING (true)` para todo y el bot ni siquiera está
--      deployado. Cerramos: bot_sessions queda solo para service_role
--      (el webhook lo gestiona desde el server), bot_templates se
--      scope al doctor dueño.
--
--   3. RLS multi-tenant para organizaciones, members e invites.
--      Hoy cualquier authenticated user puede leer todas las orgs +
--      todos los members + todos los invites. Tighten para que cada
--      doctor solo vea las orgs donde ES miembro + los miembros de
--      esas orgs + los invites pendientes que ellos crearon.
--
-- Nota sobre recursión: las policies de organization_members que
-- referencian organization_members causan loop si las escribís
-- ingenuamente. El patrón estándar de Supabase es usar una función
-- SECURITY DEFINER que liste las orgs del usuario actual — la función
-- bypasea RLS y rompe el ciclo.

-- ─── 1. Funciones — search_path explícito ───────────────────────────────────

ALTER FUNCTION public.slugify(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_booking_code() SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_booking_slug() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.accept_invite(text) SET search_path = public, pg_temp;

-- ─── 2. RLS — tablas del bot ────────────────────────────────────────────────

-- bot_sessions: tracking por número de teléfono para conversaciones del
-- bot de WhatsApp. No tiene doctor_id, las gestiona el servidor (service
-- role). Cerramos para auth/anon — service_role bypasses RLS y sigue
-- pudiendo todo. Cuando volvamos con WhatsApp y necesitemos lectura
-- desde el cliente, reabrimos con scope adecuado.
DROP POLICY IF EXISTS bot_sessions_all ON public.bot_sessions;
CREATE POLICY bot_sessions_no_client_access ON public.bot_sessions
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- bot_templates: tiene doctor_id. Scope al dueño.
DROP POLICY IF EXISTS bot_templates_all ON public.bot_templates;
CREATE POLICY bot_templates_owner_all ON public.bot_templates
  FOR ALL
  USING (doctor_id = auth.uid())
  WITH CHECK (doctor_id = auth.uid());

-- ─── 3. Helpers para multi-tenant (rompen la recursión RLS) ─────────────────

-- Lista de orgs donde el usuario actual es miembro. SECURITY DEFINER
-- para que la query interna no aplique RLS de organization_members
-- (de lo contrario las policies que la usan caen en loop).
CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid();
$$;

-- Lista de orgs donde el usuario actual es admin. Mismo patrón.
CREATE OR REPLACE FUNCTION public.user_admin_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid() AND role = 'admin';
$$;

-- Solo authenticated puede invocarlas — anon no tiene business con orgs.
REVOKE ALL ON FUNCTION public.user_org_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_admin_org_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_admin_org_ids() TO authenticated;

-- ─── 3a. RLS — organizations ───────────────────────────────────────────────

DROP POLICY IF EXISTS org_select ON public.organizations;
DROP POLICY IF EXISTS org_insert ON public.organizations;
DROP POLICY IF EXISTS org_update ON public.organizations;

-- SELECT: solo los miembros de la org pueden verla.
CREATE POLICY org_select_member ON public.organizations
  FOR SELECT
  USING (id IN (SELECT public.user_org_ids()));

-- INSERT: cualquier user autenticado puede crear una org. Quien la
-- crea queda como admin (la app hace un INSERT inmediato a
-- organization_members con role='admin' — la policy members_insert
-- de abajo lo permite porque user_id = auth.uid()).
CREATE POLICY org_insert_authenticated ON public.organizations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: solo admins de la org.
CREATE POLICY org_update_admin ON public.organizations
  FOR UPDATE
  USING (id IN (SELECT public.user_admin_org_ids()))
  WITH CHECK (id IN (SELECT public.user_admin_org_ids()));

-- ─── 3b. RLS — organization_members ────────────────────────────────────────

DROP POLICY IF EXISTS members_select ON public.organization_members;
DROP POLICY IF EXISTS members_insert ON public.organization_members;
DROP POLICY IF EXISTS members_delete ON public.organization_members;

-- SELECT: los miembros de una org ven a los demás miembros de la misma org.
CREATE POLICY members_select_same_org ON public.organization_members
  FOR SELECT
  USING (organization_id IN (SELECT public.user_org_ids()));

-- INSERT: dos caminos válidos:
--   a) el dueño que recién creó la org se agrega a sí mismo como admin
--      (user_id = auth.uid())
--   b) un admin agrega a otro miembro a su org (admin_org_ids)
-- El flujo accept_invite es SECURITY DEFINER y bypasea RLS, así que
-- no necesita pasar por esta policy.
CREATE POLICY members_insert_self_or_admin ON public.organization_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR organization_id IN (SELECT public.user_admin_org_ids())
  );

-- DELETE: el propio miembro puede salirse, o un admin puede sacar a otro.
CREATE POLICY members_delete_self_or_admin ON public.organization_members
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR organization_id IN (SELECT public.user_admin_org_ids())
  );

-- ─── 3c. RLS — organization_invites SELECT ─────────────────────────────────

-- Los CREATE / DELETE ya estaban scopeados al admin. Replace solo el SELECT.
DROP POLICY IF EXISTS "Anyone can read invites" ON public.organization_invites;

CREATE POLICY invites_select_admin ON public.organization_invites
  FOR SELECT
  USING (organization_id IN (SELECT public.user_admin_org_ids()));
