/**
 * Almacenamiento en memoria: el enunciado no pide base de datos, asi que los
 * datos se pierden al reiniciar. En produccion seria un repositorio persistente.
 */
import type { User } from '@snail/shared';

const users: User[] = [];

export const userStore = {
  all(): readonly User[] {
    return users;
  },

  findByEmail(email: string): User | undefined {
    return users.find((user) => user.email === email);
  },

  findById(id: string): User | undefined {
    return users.find((user) => user.id === id);
  },

  insert(user: User): void {
    users.push(user);
  },

// Solo para pruebas: el store es estado de modulo, y sin esto un usuario creado
// en una prueba se filtraria a la siguiente.
  clear(): void {
    users.length = 0;
  },
};
