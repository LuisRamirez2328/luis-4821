/**
 * Esquemas de validacion con Zod.
 *
 * Decision de diseño: la validacion vive en el servidor, no solo en el cliente.
 * El cliente valida por experiencia de usuario; el servidor valida porque es
 * la unica frontera confiable. Un cliente se puede modificar, el servidor no.
 */
import { z } from 'zod';

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(3, 'El nombre es obligatorio'),
    email: z.string().trim().email('Correo invalido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Las contraseñas no coinciden',
    path: ['passwordConfirm'],
  });

export const loginSchema = z.object({
  email: z.string().trim().email('Correo invalido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});
