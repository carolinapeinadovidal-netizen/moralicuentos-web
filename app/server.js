import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3000;

// En local y en servidores tradicionales (Render, Railway, VPS) el propio Node sirve la web.
// En Vercel los archivos de /public los sirve la plataforma y solo se usa api/index.js.
app.use(express.static(path.join(here, 'public'), { maxAge: '1h' }));

app.listen(port, () => console.log(`Moralicuentos CRM en http://localhost:${port}`));
