# Tecito — guía para Claude (y para vos)

Notas operativas que conviene tener a mano antes de tocar el código.
Ordenadas por orden de "qué pasa más seguido al modificar el repo".

---

## Stack rápido

- **Frontend**: React 19 + Vite + TypeScript + Tailwind v4 (con `@utility`,
  no usar `.class` plano si necesitás variantes responsivas).
- **Backend**: Supabase (Postgres + RLS + Auth + Edge Functions para ICS).
- **Serverless**: Vercel (`/api/*.ts`) para todo lo que necesita un Node
  runtime: mails (Resend), MercadoPago webhooks, cron de recordatorios,
  cron de expirar planes.
- **Mails**: Resend, dominio `tecito.com.ar`. Templates en `/emails/*.tsx`
  con React Email, pre-compilados a HTML por `scripts/build-emails.ts`
  hacia `/api/_compiled-emails/*.html` (Vercel los empaqueta vía
  `functions.includeFiles`).
- **Pagos**: MercadoPago. Toda la lógica vive en `/api/mp-*.ts`. NO usar
  las copias en `supabase/functions/` (están borradas; si reaparecen,
  eliminar).

## Reglas que aprendimos a los golpes

### 1. Migrations: GRANTs explícitos siempre

Supabase cambia el default el 30/oct/2026: tablas nuevas no van a estar
expuestas en la Data API a menos que les hagamos `GRANT` explícito. Para
no tener que retrofitear todo el día anterior, **toda migration que
cree tabla nueva** tiene que terminar con bloque de grants.

Template canónico:

```sql
CREATE TABLE public.nombre_tabla (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
);

-- RLS (esto ya lo hacíamos)
ALTER TABLE public.nombre_tabla ENABLE ROW LEVEL SECURITY;
CREATE POLICY ... ON public.nombre_tabla ...;

-- Grants — obligatorio post-oct/2026, recomendado desde ahora.
-- Decidí caso por caso si anon entra:
--   • Algo del booking público / slot generator → SELECT a anon
--   • Algo que el paciente crea (patients, appointments) → INSERT a anon
--   • Cualquier otra cosa → solo authenticated
GRANT SELECT ON public.nombre_tabla TO anon, authenticated;          -- si pública
GRANT INSERT, UPDATE, DELETE ON public.nombre_tabla TO authenticated; -- si la edita el doctor
```

Si la tabla la consume **solo** un endpoint serverless con
`SUPABASE_SERVICE_ROLE_KEY`, NO hace falta GRANT (service_role bypassea
todo). Pero si la lee `supabase-js` desde el navegador, sí.

La defensa actual está en
`supabase/migrations/20260528120000_explicit_data_api_grants.sql`
— relee qué tabla recibe qué grant si tenés duda.

### 2. Tailwind v4: utilities personales van con `@utility`, no `.class`

En `src/index.css`, las utilities propias (ej. `scrollbar-hide`) **se
declaran con `@utility nombre { ... }`**, no como una regla CSS suelta.
Sin `@utility`, las variantes responsivas (`lg:scrollbar-hide`) no
generan nada y la regla solo aplica sin prefijo. Aprendimos este por
varios días viendo scrollbars empujar el contenido.

### 3. Vercel serverless + .tsx en subdirectorios

El bundler de Vercel no resuelve confiablemente `.tsx` en
`/api/subdir/`. Por eso los templates de mails se pre-compilan a HTML
estático en `/api/_compiled-emails/` y los handlers los leen con `fs`.
Si vas a sumar un mail nuevo:

1. Crear `emails/Nombre.tsx` con el layout compartido (`./_layout`).
2. Registrar en `scripts/build-emails.ts` (array `TEMPLATES`).
3. El handler hace `readFileSync(join(process.cwd(), 'api',
   '_compiled-emails', 'nombre.html'))`.
4. `vercel.json` ya lista `includeFiles: "api/_compiled-emails/**"`
   para cada función que necesita mails.

### 4. Mails de Vercel: **awaitear** los fetch entre serverless

`void fetch(...)` muere cuando el handler resuelve el response —
Vercel congela el container. Aprendido con el mail de cancelación al
doctor que nunca llegaba. Si dispará un mail desde un endpoint, hacé
`await` aunque agregue 1-2s de latencia.

### 5. MercadoPago: lecciones del audit

Documentado en detalle en los commits, pero los principios:

- **`plan_status` terminal** (`cancelled` / `past_due` / `expired`) no
  puede ser revivido por un `payment.approved` ni un
  `preapproval.paused/cancelled`. Solo `preapproval.authorized` (una
  sub fresca) puede sacar al usuario de ahí. Ver `mp-webhook.ts`.
- **`plan_valid_until`** siempre se lee del `preapproval.next_payment_date`
  real, no se calcula con `new Date() + 1mes`. Si MP retrasa un cobro,
  el ciclo no se desfasa.
- **Idempotencia**: `X-Idempotency-Key` en POST `/preapproval` (hash de
  `userId+planId+cardToken`). Cliente que reintenta tras timeout no
  crea sub duplicada.
- **Webhook signature**: rechazar 401 si la firma no valida. Aceptar
  igual ("for debug") es un vector de DoS contra `MP_ACCESS_TOKEN`.
- **`billing_events`** tiene UNIQUE parcial sobre
  `(mp_resource_id, event_type) WHERE source='webhook'`. Insertar con
  `upsert(..., { ignoreDuplicates: true, onConflict: ... })` — helper
  `recordEvent()` en `mp-webhook.ts`.

### 6. Argentina UTC-3, no Date#toLocale

Para fechas operativas (cron "mañana", recordatorios) usar manipulación
manual de UTC, no `toLocaleDateString({ timeZone })` que devuelve
strings con formato local que varían entre runtimes. Ver
`tomorrowInArgentina()` en `api/cron/send-reminders.ts` como ejemplo.

### 7. Secretos: NUNCA por chat

Generación de secretos (CRON_SECRET, CANCEL_TOKEN_SECRET, MP keys,
etc.) tiene que ir provider → clipboard → Vercel env vars (o macOS
Keychain). Nunca pegarlos en el chat de Claude — quedan en el
transcript y hay que rotarlos. Si por accidente pasa: revocar +
regenerar inmediato.

### 8. WhatsApp Cloud API: pospuesto

No hay integración con WhatsApp Business API hoy. Los botones
`💬 WhatsApp` que hay (en agenda, MyLink, PatientPanel) abren
`wa.me/?text=...` desde el navegador del doctor — el mensaje sale de
su WhatsApp personal, NO por Tecito. La copy de la landing, BookingModal,
plans, terms y security está alineada con esto. **No prometer
recordatorios automáticos por WhatsApp** hasta que volvamos al tema
(estimado: 1-2 meses cuando esté listo Monotributo + Meta verification).

### 9. `BotConfigView` está huérfano

El archivo existe (`src/components/config/BotConfigView.tsx`) pero no
se importa en ningún lado. Lo mantenemos congelado para cuando volvamos
con WhatsApp. No es bug, no borrarlo.

### 10. Logging de transcripciones

Cuando Vercel deployea, el log path para los webhooks de MP y el cron
de recordatorios es Vercel Functions → seleccionar la función → ver
logs en tiempo real. Para SQL sobre la DB directo usar Supabase
Dashboard → SQL Editor. `billing_events` es la fuente de verdad de
qué pasó con cada usuario en MP — siempre empezar ahí cuando reporten
algo raro de pagos.

---

## Convenciones de código

- Idioma: comentarios y docstrings **en inglés**, errores user-facing
  **en español rioplatense** (vos, no tú; "Probá de nuevo" no
  "Inténtelo de nuevo").
- Imports: nunca relativos profundos (`../../../`). Usar paths cortos
  desde `src/`.
- `console.warn` / `console.error` con prefijo `[modulo]` para grepear
  rápido en logs (ej. `[mp-webhook]`, `[send-reminders]`).
- No emoji en código a menos que el usuario lo pida explícitamente.
- Errores serverless: log al server + 4xx/5xx con `{ error, message }`
  al cliente. El cliente muestra `message` si está, sino genérico.
