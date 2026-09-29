/**
 * CONFIGURACION DE EXPRESS
 * ---------------------------------------------------------------------------
 * Aqui se ensambla todo. NO se llama a listen(): eso lo hace index.ts.
 *
 * La separacion permite que las pruebas usen supertest(app) sin abrir un
 * puerto real, que es lo que hace las pruebas de rutas viables.
 */
import express from 'express';
import cors from 'cors';
import { authRoutes } from './routes/authRoutes.js';
import { snailPayRoutes, raceRoutes } from './routes/snailPayRoutes.js';
import { adjuntarUsuario } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';

export const app = express();

// CORS: permite que el frontend (puerto 5173) llame a este servidor
// (puerto 4000). Son origenes distintos, y sin esto el navegador lo bloquea.
app.use(cors());

// express.json() convierte el body de la peticion (que llega como texto) en
// un objeto de JavaScript. Sin esto, req.body estaria vacio.
app.use(express.json());

// Se registra antes que las rutas para que req.user quede disponible en
// cualquier ruta, protegida o no.
app.use(adjuntarUsuario);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/snailpay', snailPayRoutes);
app.use('/api/races', raceRoutes);

// 404 primero: si ninguna ruta de arriba respondio, el error pasa al
// manejador. El manejador va al final para capturar todo lo lanzado antes.
app.use(notFoundHandler);
app.use(errorHandler);
