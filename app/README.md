# Moralicuentos CRM

CRM de *Los Moralicuentos de la Iaia Carola*: familias, cuentos, panel de control y asistente IA para crear cuentos.

- **Backend:** Node 20+ y Express (`app.js`).
- **Base de datos:** Supabase (Postgres). El esquema está en `supabase/migrations/001_init.sql`.
- **Frontend:** HTML, CSS y JS sin build (`public/`).
- **Acceso:** usuario y contraseña de la tabla `usuarios` de Supabase (contraseña cifrada con bcrypt). Usuario inicial: `admin` / `admin`.
- **Asistente IA:** API de Anthropic, llamada desde el servidor (la clave nunca llega al navegador).

## 1. Base de datos (Supabase)

1. Crea un proyecto en <https://supabase.com> (o usa uno existente).
2. En **SQL Editor** pega y ejecuta `supabase/migrations/001_init.sql`.
3. Ejecuta `supabase/migrations/002_usuarios.sql`: crea la tabla `usuarios` con el usuario `admin` / `admin`.
4. Opcional: ejecuta `supabase/seed.sql` para cargar 4 familias y 3 cuentos de ejemplo (llevan "(ejemplo)" en el nombre).
5. En **Project Settings > API** copia la URL y la clave `service_role`.

Las tablas tienen RLS activado y ninguna política: solo el servidor, con la clave `service_role`, puede leerlas o escribirlas.

Tablas: `usuarios`, `cuentos`, `familias`, `hijos`, `interacciones`, `favoritos`. Funciones: `comprobar_login` (comprueba usuario y contraseña), `guardar_familia` (guarda una familia con sus peques, historial y favoritos en una transacción) e `incrementar_vistas`.

## 2. Ejecutar en local

```bash
cp .env.example .env     # y rellena los valores
npm install
npm run dev              # http://localhost:3000
```

## 3. Publicar en la web

### Vercel (recomendado)
1. Sube el repositorio a GitHub.
2. En Vercel: **Add New > Project**, importa el repositorio. No hace falta comando de build.
3. En **Settings > Environment Variables** añade las de `.env.example`.
4. Pulsa **Deploy**. `vercel.json` ya sirve `public/` y manda `/api/*` a Express.

### Render, Railway o un servidor propio
Comando de arranque `npm start`, con las mismas variables de entorno.

## Variables de entorno

| Variable | Para qué |
|---|---|
| `SUPABASE_URL` | URL del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta del servidor. Nunca en Git ni en el navegador |
| `SESSION_SECRET` | Clave aleatoria (32+ caracteres) para firmar las sesiones del panel |
| `ANTHROPIC_API_KEY` | Asistente IA (opcional) |
| `ANTHROPIC_MODEL` | Modelo del asistente (por defecto `claude-sonnet-5-5`) |

## API

Panel (requiere `Authorization: Bearer <token>`):
`POST /api/auth/login`, `POST /api/auth/refresh`, `GET|PUT|DELETE /api/cuentos[/:id]`, `GET|PUT|DELETE /api/familias[/:id]`, `POST /api/ia/generar`.

Pública, para la app de las familias:
- `GET /api/public/cuentos`: cuentos publicados.
- `POST /api/public/cuentos/:id/vista`: suma una visita.
- `POST /api/public/registro` con `{nombre, email}`: crea la familia como "registrada".

## Pendiente

El login de las familias (cuentas con contraseña, favoritos propios) aún no existe. La vista "Vista familia" del panel solo simula la app.
