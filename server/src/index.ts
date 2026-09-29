/**
 * Punto de entrada del proceso.
 *
 * Responsabilidad unica: arrancar el servidor HTTP.
 * Toda la configuracion de Express vive en app.ts para que las pruebas
 * puedan importar la app sin abrir un puerto.
 */
import { app } from './app.js';
import { config } from './config/index.js';

app.listen(config.port, () => {
  console.log(`Servidor escuchando en http://localhost:${config.port}`);
});
