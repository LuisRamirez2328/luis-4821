/**
 * Almacenamiento en memoria de la simulacion.
 *
 * Decision de diseño: esta prueba NO usa base de datos, asi que los datos
 * viven en memoria y se pierden al reiniciar el proceso. Es aceptable aqui
 * porque la especificacion lo pide de forma explicita; en produccion se
 * reemplazaria por un repositorio persistente.
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

  /**
   * Vacia el store.
   *
   * Existe solo para las pruebas. Es necesario porque el store es un modulo
   * con estado: sin este metodo, un usuario creado en una prueba se filtraria
   * a la siguiente y las pruebas dejarian de ser independientes entre si.
   */
  clear(): void {
    users.length = 0;
  },
};
