/**
 * PRUEBAS DEL SERVICIO DE AUTENTICACION
 * ===========================================================================
 * Por que se prueba esto:
 *
 * El enunciado dice que "la forma en que decidas tratar y almacenar la
 * contrasena es parte de la evaluacion". Es la decision de seguridad central
 * de la aplicacion, asi que necesita pruebas que laProtejan.
 *
 * Que se verifica:
 *   1. La contrasena NUNCA se guarda en texto plano.
 *   2. Dos usuarios con la misma contrasena producen hashes distintos.
 *   3. El correo es unico (sin distincion de mayusculas).
 *   4. El login falla con credenciales incorrectas.
 *   5. El login falla con correo inexistente, y con el MISMO mensaje, para
 *      no permitir enumerar cuentas.
 *   6. El token permite recuperar el usuario y cerrar la sesion lo invalida.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { registrar, iniciarSesion, cerrarSesion, usuarioDesdeToken, reiniciarSesiones } from '../services/authService.js';
import { userStore } from '../data/store.js';

// El store y el Map de sesiones son modulos con estado. Sin este reset, los
// datos de una prueba se filtrarian a la siguiente.
beforeEach(() => {
  userStore.clear();
  reiniciarSesiones();
});

describe('authService', () => {
  it('guarda la contrasena hasheada, nunca en texto plano', async () => {
    const correo = 'luis@ejemplo.com';
    await registrar('Luis Ramirez', correo, 'contrasenaSegura1');

    const guardado = userStore.findByEmail(correo);
    expect(guardado).toBeDefined();
    expect(guardado!.passwordHash).not.toBe('contrasenaSegura1');
    // Formato de hash de bcrypt: $2b$10$...
    expect(guardado!.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  it('genera hashes distintos para la misma contrasena (salt por usuario)', async () => {
    await registrar('Luis One', 'uno@ejemplo.com', 'mismaContrasena1');
    await registrar('Luis Two', 'dos@ejemplo.com', 'mismaContrasena1');

    const hashUno = userStore.findByEmail('uno@ejemplo.com')!.passwordHash;
    const hashDos = userStore.findByEmail('dos@ejemplo.com')!.passwordHash;

    // Si fueran iguales, un atacante podria romper todas las cuentas de un
    // solo golpe con una tabla precalculada.
    expect(hashUno).not.toBe(hashDos);

    // Pero ambos deben seguir validando la misma contrasena.
    expect(await bcrypt.compare('mismaContrasena1', hashUno)).toBe(true);
    expect(await bcrypt.compare('mismaContrasena1', hashDos)).toBe(true);
  });

  it('no permite registrar dos veces el mismo correo, sin importar mayusculas', async () => {
    await registrar('Luis', 'luis@ejemplo.com', 'contrasenaSegura1');
    await expect(registrar('Otro', 'LUIS@EJEMPLO.COM', 'contrasenaSegura1')).rejects.toThrow(
      'El correo ya esta registrado',
    );
  });

  it('inicia sesion con credenciales correctas', async () => {
    await registrar('Luis', 'luis@ejemplo.com', 'contrasenaSegura1');
    const resultado = await iniciarSesion('luis@ejemplo.com', 'contrasenaSegura1');
    expect(resultado.user.email).toBe('luis@ejemplo.com');
    expect(resultado.token).toBeTruthy();
  });

  it('rechaza una contrasena incorrecta', async () => {
    await registrar('Luis', 'luis@ejemplo.com', 'contrasenaSegura1');
    await expect(iniciarSesion('luis@ejemplo.com', 'malaClave999')).rejects.toThrow(
      'Credenciales invalidas',
    );
  });

  it('usa el mismo mensaje para correo inexistente y contrasena incorrecta', async () => {
    await registrar('Luis', 'luis@ejemplo.com', 'contrasenaSegura1');

    // Si los mensajes fueran distintos, un atacante podria discovering quais
    // correos estan registrados: basta con leer el texto de la respuesta.
    const errorNoExiste = await iniciarSesion('nadie@ejemplo.com', 'loSeaLoQueSea1').catch(
      (e: Error) => e.message,
    );
    const errorClaveMala = await iniciarSesion('luis@ejemplo.com', 'malaClave999').catch(
      (e: Error) => e.message,
    );

    expect(errorNoExiste).toBe(errorClaveMala);
  });

  it('el token resuelve al usuario y cerrar sesion lo invalida', async () => {
    const { token, user } = await registrar('Luis', 'luis@ejemplo.com', 'contrasenaSegura1');

    expect(usuarioDesdeToken(token)?.id).toBe(user.id);

    cerrarSesion(token);
    // Tras cerrar sesion, el token ya no debe resolver a nadie.
    expect(usuarioDesdeToken(token)).toBeUndefined();
  });

  it('nunca expone el hash en la respuesta publica', async () => {
    const { user } = await registrar('Luis', 'luis@ejemplo.com', 'contrasenaSegura1');
    expect(Object.keys(user)).not.toContain('passwordHash');
  });
});
