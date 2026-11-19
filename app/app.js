import express from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SESSION_SECRET,
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL = 'claude-sonnet-5-5',
} = process.env;

const configured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SESSION_SECRET && SESSION_SECRET.length >= 32);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
// Cliente con permisos totales: solo vive en el servidor, nunca llega al navegador.
const db = configured ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opts) : null;

const ETAPAS = ['interesada', 'registrada', 'suscriptora', 'inactiva'];
const EDADES = ['2–4', '4–6', '6–9'];
const ESTADOS = ['borrador', 'publicado'];
const PERSONAJE = ['sin empezar', 'cuestionario enviado', 'cuestionario recibido', 'personaje listo'];
const TIPOS = ['Email', 'WhatsApp', 'Llamada', 'Reunión', 'Nota'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error(`${req.method} ${req.path}:`, err.message || err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Error interno del servidor' });
  });
const fail = (status, message) => Object.assign(new Error(message), { status });
const need = (cond, msg) => { if (!cond) throw fail(400, msg); };
const str = (v, max = 5000) => (v == null ? '' : String(v).slice(0, max));
const dbOk = (r) => { if (r.error) throw fail(500, r.error.message); return r.data; };

app.get('/api/health', (_req, res) => res.json({ ok: true, database: configured, ai: Boolean(ANTHROPIC_API_KEY) }));

app.use('/api', (_req, _res, next) => {
  if (!configured) return next(fail(503, 'Faltan variables de entorno (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o SESSION_SECRET).'));
  next();
});

/* ---------------- autenticación ---------------- */
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiados intentos. Espera unos minutos.' } });

// Sesiones firmadas con SESSION_SECRET (HMAC-SHA256). Los usuarios están en la tabla public.usuarios.
const ACCESS_TTL = 8 * 60 * 60;      // 8 horas
const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 días
const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');

function makeToken(user, kind, ttl) {
  const body = b64(JSON.stringify({ sub: user.id, u: user.usuario, r: user.rol, k: kind, exp: Math.floor(Date.now() / 1000) + ttl }));
  return `${body}.${sign(body)}`;
}
function readToken(token, kind) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (p.k !== kind || !p.exp || p.exp < Date.now() / 1000) return null;
    return p;
  } catch { return null; }
}
const session = (user) => ({
  token: makeToken(user, 'access', ACCESS_TTL),
  refresh: makeToken(user, 'refresh', REFRESH_TTL),
  email: user.usuario, // el panel muestra este campo como nombre de usuario
});

app.post('/api/auth/login', authLimit, wrap(async (req, res) => {
  const usuario = str(req.body.usuario ?? req.body.email, 100).trim();
  const password = str(req.body.password, 200);
  need(usuario && password, 'Escribe tu usuario y tu contraseña.');
  const rows = dbOk(await db.rpc('comprobar_login', { p_usuario: usuario, p_password: password }));
  if (!rows || !rows.length) throw fail(401, 'Usuario o contraseña incorrectos.');
  res.json(session(rows[0]));
}));

app.post('/api/auth/refresh', authLimit, wrap(async (req, res) => {
  const p = readToken(str(req.body.refresh, 1000), 'refresh');
  if (!p) throw fail(401, 'La sesión ha caducado.');
  const user = dbOk(await db.from('usuarios').select('id,usuario,rol,activo').eq('id', p.sub).maybeSingle());
  if (!user || !user.activo) throw fail(401, 'La sesión ha caducado.');
  res.json(session(user));
}));

const requireAdmin = (req, res, next) => {
  (async () => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!m) throw fail(401, 'Inicia sesión para continuar.');
    const p = readToken(m[1], 'access');
    if (!p) throw fail(401, 'La sesión no es válida.');
    req.admin = p.u;
  })().then(() => next(), (err) => res.status(err.status || 500).json({ error: err.status ? err.message : 'Error interno del servidor' }));
};

/* ---------------- ayudas de mapeo ---------------- */
const CUENTO_COLS = 'id,titulo,edad,valor,estado,video,descripcion,sinopsis,actividad,pregunta,moraleja,vistas,creado';

function cuentoOut(r) {
  return { ...r };
}
function familiaOut(r) {
  return {
    id: r.id,
    nombre: r.nombre,
    email: r.email || '',
    etapa: r.etapa,
    personaje: r.personaje,
    notas: r.notas,
    proximo: r.proximo || '',
    alta: r.alta,
    hijos: (r.hijos || []).sort((a, b) => a.orden - b.orden).map((h) => ({ nombre: h.nombre, edad: h.edad == null ? '' : h.edad })),
    interacciones: (r.interacciones || []).sort((a, b) => a.orden - b.orden).map((x) => ({ fecha: x.fecha, tipo: x.tipo, texto: x.texto })),
    favoritos: (r.favoritos || []).map((f) => f.cuento_id),
  };
}
const FAMILIA_SELECT = '*, hijos(nombre,edad,orden), interacciones(fecha,tipo,texto,orden), favoritos(cuento_id)';

async function getFamilia(id) {
  const r = dbOk(await db.from('familias').select(FAMILIA_SELECT).eq('id', id).maybeSingle());
  return r ? familiaOut(r) : null;
}

/* ---------------- cuentos (panel) ---------------- */
const admin = express.Router();
admin.use(requireAdmin);

admin.get('/cuentos', wrap(async (_req, res) => {
  const rows = dbOk(await db.from('cuentos').select(CUENTO_COLS).order('creado', { ascending: false }));
  res.json(rows.map(cuentoOut));
}));

admin.put('/cuentos/:id', wrap(async (req, res) => {
  const { id } = req.params;
  need(UUID.test(id), 'Identificador no válido.');
  const b = req.body || {};
  const row = {
    id,
    titulo: str(b.titulo, 200).trim(),
    edad: str(b.edad),
    valor: str(b.valor, 60),
    estado: str(b.estado),
    video: str(b.video, 500).trim(),
    descripcion: str(b.descripcion, 400),
    sinopsis: str(b.sinopsis, 6000),
    actividad: str(b.actividad, 1500),
    pregunta: str(b.pregunta, 800),
    moraleja: str(b.moraleja, 800),
  };
  need(row.titulo, 'Escribe el título del cuento.');
  need(EDADES.includes(row.edad), 'La edad recomendada no es válida.');
  need(ESTADOS.includes(row.estado), 'El estado no es válido.');
  need(!row.video || /^https?:\/\//i.test(row.video), 'El enlace del vídeo debe empezar por http:// o https://');
  if (DATE.test(str(b.creado))) row.creado = b.creado;
  // "vistas" no se envía: lo cuenta la app pública y no debe pisarse al editar.
  dbOk(await db.from('cuentos').upsert(row, { onConflict: 'id' }));
  const saved = dbOk(await db.from('cuentos').select(CUENTO_COLS).eq('id', id).single());
  res.json(cuentoOut(saved));
}));

admin.delete('/cuentos/:id', wrap(async (req, res) => {
  need(UUID.test(req.params.id), 'Identificador no válido.');
  dbOk(await db.from('cuentos').delete().eq('id', req.params.id));
  res.json({ ok: true });
}));

/* ---------------- familias (panel) ---------------- */
admin.get('/familias', wrap(async (_req, res) => {
  const rows = dbOk(await db.from('familias').select(FAMILIA_SELECT).order('nombre'));
  res.json(rows.map(familiaOut));
}));

admin.put('/familias/:id', wrap(async (req, res) => {
  const { id } = req.params;
  need(UUID.test(id), 'Identificador no válido.');
  const b = req.body || {};
  const email = str(b.email, 200).trim();
  const p = {
    id,
    nombre: str(b.nombre, 200).trim(),
    email,
    etapa: str(b.etapa),
    personaje: str(b.personaje) || 'sin empezar',
    notas: str(b.notas, 6000),
    proximo: DATE.test(str(b.proximo)) ? b.proximo : '',
    alta: DATE.test(str(b.alta)) ? b.alta : '',
    hijos: (Array.isArray(b.hijos) ? b.hijos : []).slice(0, 12).map((h) => {
      const edad = parseInt(h?.edad, 10);
      return { nombre: str(h?.nombre, 100).trim(), edad: Number.isFinite(edad) ? Math.min(12, Math.max(1, edad)) : '' };
    }),
    interacciones: (Array.isArray(b.interacciones) ? b.interacciones : []).slice(0, 300).map((x) => ({
      fecha: DATE.test(str(x?.fecha)) ? x.fecha : '',
      tipo: TIPOS.includes(x?.tipo) ? x.tipo : 'Nota',
      texto: str(x?.texto, 1000),
    })),
    favoritos: (Array.isArray(b.favoritos) ? b.favoritos : []).filter((x) => UUID.test(String(x))).slice(0, 200),
  };
  need(p.nombre, 'Escribe el nombre de la familia.');
  need(!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'El email no parece válido.');
  need(ETAPAS.includes(p.etapa), 'La etapa no es válida.');
  need(PERSONAJE.includes(p.personaje), 'El estado del personaje no es válido.');
  dbOk(await db.rpc('guardar_familia', { p }));
  res.json(await getFamilia(id));
}));

admin.delete('/familias/:id', wrap(async (req, res) => {
  need(UUID.test(req.params.id), 'Identificador no válido.');
  dbOk(await db.from('familias').delete().eq('id', req.params.id));
  res.json({ ok: true });
}));

/* ---------------- asistente IA ---------------- */
const aiLimit = rateLimit({ windowMs: 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiadas peticiones al asistente. Espera un minuto.' } });

function iaPrompt(tipo, f, resumen) {
  const base = `Eres guionista de "Los Moralicuentos de la Iaia Carola", cuentos infantiles con valores. La protagonista es Pepita, una niña pelirroja, y la Iaia Carola cuenta los cuentos junto a la chimenea. Tono cálido, mágico y sencillo, en español de España, adaptado a niños de ${f.edad} años.\n\nDatos del cuento:\n- Nombre: ${f.nombre}\n- Temática: ${f.tema}\n- Mensaje o valor: ${f.valor}\n- Personajes: ${f.personajes}\n` +
    (tipo !== 'resumen' && resumen ? `\nResumen ya aprobado del cuento:\n${resumen}\n` : '');
  const pide = {
    resumen: 'Escribe un resumen del cuento de unas 120 palabras con inicio, nudo y desenlace, y termina con la moraleja en una frase que empiece por "Moraleja:".',
    escenas: 'Divide el cuento en 5 escenas numeradas. Cada una con un título corto y 2 o 3 frases.',
    dialogos: 'Escribe los diálogos principales entre los personajes, en formato NOMBRE: frase. Frases cortas y fáciles de entender para la edad indicada.',
    guion: 'Escribe un guion para un vídeo de 2 a 3 minutos narrado por la Iaia Carola. Por cada bloque indica Imagen, Narración y Música (relajante).',
    imagenes: 'Escribe 5 descripciones para generar ilustraciones, una por escena. Estilo acuarela cálida, Pepita siempre reconocible por su pelo pelirrojo, sin texto dentro de la imagen.',
  }[tipo];
  return `${base}\n${pide}\nResponde solo con el contenido, sin introducción.`;
}

admin.post('/ia/generar', aiLimit, wrap(async (req, res) => {
  if (!ANTHROPIC_API_KEY) throw fail(503, 'El asistente IA no está configurado (falta ANTHROPIC_API_KEY).');
  const { tipo, form = {}, resumen = '' } = req.body || {};
  need(['resumen', 'escenas', 'dialogos', 'guion', 'imagenes'].includes(tipo), 'Tipo de material no válido.');
  const f = {
    nombre: str(form.nombre, 200), tema: str(form.tema, 300),
    edad: EDADES.includes(form.edad) ? form.edad : '4–6',
    valor: str(form.valor, 300), personajes: str(form.personajes, 300),
  };
  need(f.nombre.trim() && f.valor.trim(), 'Escribe al menos el nombre y el valor del cuento.');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1800, messages: [{ role: 'user', content: iaPrompt(tipo, f, str(resumen, 4000)) }] }),
    signal: AbortSignal.timeout(55000),
  });
  if (!r.ok) {
    console.error('Anthropic', r.status, (await r.text()).slice(0, 300));
    throw fail(502, r.status === 429 ? 'El servicio de IA está saturado. Inténtalo en un minuto.' : 'No se pudo generar el texto. Inténtalo de nuevo.');
  }
  const j = await r.json();
  const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
  need(text, 'La IA no devolvió texto. Inténtalo de nuevo.');
  res.json({ text });
}));

/* ---------------- API pública (la app de las familias) ---------------- */
const pub = express.Router();
const pubLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiadas peticiones. Inténtalo más tarde.' } });
const regLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiados registros desde esta conexión.' } });

pub.get('/cuentos', pubLimit, wrap(async (_req, res) => {
  const rows = dbOk(await db.from('cuentos').select('id,titulo,edad,valor,descripcion,sinopsis,video,actividad,pregunta,moraleja').eq('estado', 'publicado').order('creado', { ascending: false }));
  res.set('Cache-Control', 'public, max-age=60').json(rows);
}));

pub.post('/cuentos/:id/vista', pubLimit, wrap(async (req, res) => {
  need(UUID.test(req.params.id), 'Identificador no válido.');
  dbOk(await db.rpc('incrementar_vistas', { cuento: req.params.id }));
  res.status(204).end();
}));

pub.post('/registro', regLimit, wrap(async (req, res) => {
  const nombre = str(req.body?.nombre, 200).trim();
  const email = str(req.body?.email, 200).trim().toLowerCase();
  need(nombre, 'Escribe tu nombre.');
  need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'El email no parece válido.');
  const hoy = new Date().toISOString().slice(0, 10);
  const ya = dbOk(await db.from('familias').select('id').ilike('email', email).limit(1));
  // Respuesta idéntica si ya existía, para no revelar qué emails están registrados.
  if (!ya.length) {
    dbOk(await db.rpc('guardar_familia', { p: {
      id: crypto.randomUUID(), nombre, email, etapa: 'registrada', alta: hoy,
      interacciones: [{ fecha: hoy, tipo: 'Nota', texto: 'Alta desde la web' }],
    } }));
  }
  res.status(201).json({ ok: true });
}));
app.use('/api/public', pub);
app.use('/api', admin);

app.use('/api', (_req, res) => res.status(404).json({ error: 'No encontrado' }));
app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON no válido.' });
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Error interno del servidor' });
});

export default app;
