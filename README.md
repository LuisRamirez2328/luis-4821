# Carreras de Caracoles

Aplicación full-stack de demostración: registro e inicio de sesión, dashboard
protegido con saldo, recarga mediante una pasarela simulada y visualización de
un día de carreras.

**Stack:** React 18 + TypeScript (Vite) · Express + TypeScript · LocalStorage · Vitest

---

## 1. Requisitos

- Node.js 20 o superior (probado en 24.12)
- npm 10 o superior

## 2. Instalación

```bash
npm install
```

## 3. Cómo ejecutar

Se necesitan **dos terminales**, porque son dos procesos distintos.

**Terminal 1 — servidor (API en el puerto 4000):**

```bash
npm run dev:server
```

**Terminal 2 — cliente (interfaz en el puerto 5173):**

```bash
npm run dev:client
```

Abrir <http://localhost:5173>.

> En PowerShell, `curl` es un alias de `Invoke-WebRequest`. Para probar la API
> usa `Invoke-RestMethod http://localhost:4000/api/health` en lugar de `curl`.

## 4. Verificación

```bash
npm run typecheck   # revisión de tipos de cliente y servidor
npm run test        # 66 pruebas automatizadas
npm run build       # compilación de producción
npm run test:all    # los tres, en orden
```

## 5. Endpoints de la API

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/health` | público | Comprobación de disponibilidad |
| `POST` | `/api/auth/register` | público | Crear cuenta, abre sesión |
| `POST` | `/api/auth/login` | público | Iniciar sesión |
| `POST` | `/api/auth/logout` | sesión | Invalidar el token |
| `GET` | `/api/auth/me` | sesión | Verificar si el token sigue válido |
| `GET` | `/api/races/today` | público | Día simulado (6 carreras) |
| `POST` | `/api/snailpay/charge` | sesión | Recargar saldo |
| `POST` | `/api/snailpay/simulate-outage` | sesión | Activar el escenario de caída |
| `POST` | `/api/snailpay/restore` | sesión | Restaurar el servicio |

Las rutas marcadas como *sesión* exigen la cabecera
`Authorization: Bearer <token>`. Sin ella devuelven `401`.

## 6. Datos de prueba de SnailPay

| Dato | Valor |
| --- | --- |
| Tarjeta válida | `1234123412341234` |
| Vencimiento | `12/26` |
| CVV | `543` |
| Nombre | cualquiera no vacío |
| Monto | entero entre `1` y `20 000` |

### Escenarios

| # | Cómo dispararlo | `status` | HTTP | `authorization_code` |
| --- | --- | --- | --- | --- |
| 1 | Tarjeta válida | `approved` | 200 | `SNP-OK` |
| 2 | `4000000000000002`, o cualquier dato inválido | `declined` | 402 | `null` |
| 3 | `POST /api/snailpay/simulate-outage`, o tarjeta `0000000000000000` | `error` | 503 | `null` |

En los escenarios 2 y 3 **el saldo no se modifica**. La garantía está en
`client/src/components/organisms/SnailPayForm.tsx`: el saldo solo aumenta dentro
de `if (respuesta.status === 'approved')`.

### Formato de la respuesta

El contrato vive en `shared/src/index.ts` (`SnailPayResponse`), de modo que el
cliente y el servidor no puedan desincronizarse. Son once campos:

| Campo | Tipo | Contenido |
| --- | --- | --- |
| `id` | `string` | Identificador de la operación |
| `status` | `'approved' \| 'declined' \| 'error'` | Resultado de la operación |
| `status_detail` | `string` | Explicación legible del resultado |
| `transaction_amount` | `number` | Monto cobrado |
| `date_created` | `string` | Fecha y hora de la operación |
| `authorization_code` | `string \| null` | `SNP-OK` solo si se aprueba; `null` si no |
| `reference` | `string` | Referencia de la transacción |
| `payer_id` | `string` | Identificador del pagador |
| `payer_email` | `string` | Correo del pagador |
| `cardNumber` | `string` | Número de tarjeta, devuelto tal como se recibió |
| `cvv` | `string` | Código de seguridad, devuelto tal como se recibió |

Los dos últimos los exige el enunciado, que pide que la pasarela devuelva los
datos de la tarjeta. En una pasarela real no se harían nunca: el código de
seguridad no debe salir del navegador ni quedar registrado en ningún log. Aquí se
devuelven solo porque el requisito es explícito, y el propio código lo advierte.

### Validación en tres capas del monto

El monto se valida en tres sitios, y cada uno tiene un propósito distinto:

1. **Atributos `min`/`max` del input** — primera barrera en el navegador.
2. **`validarMonto()` en el componente** — feedback inmediato, con estilos.
3. **Zod y el servicio, en el servidor** — la única capa que no se puede saltar.

El formulario lleva `noValidate` a propósito. Sin eso, el navegador bloquearía
el envío con su propia burbuja y la validación de la aplicación nunca se
ejecutaría, dejando al usuario con un aviso del sistema en vez del mensaje
accesible de la app.

### Límite superior del monto: un bug real

La primera versión validaba el monto solo como «mayor que cero». Durante una
prueba manual se tecleó por error un número de tarjeta en el campo de monto, y
la pasarela aprobó una recarga de **4 000 000 000 000 702**, dejando el saldo en
esa cifra.

El monto no es un entero cualquiera: es dinero. Sin un techo, cualquier valor
absurdo pasa por ser positivo. La corrección añade un rango cerrado
(`MONTO_MINIMO` / `MONTO_MAXIMO`), y hay pruebas de regresión para los tres casos
que lo permitían: número de tarjeta en el campo, monto decimal y monto no
finito.

### El saldo no pertenecía a la cuenta

Corregido el monto, el saldo corrupto seguía apareciendo. Al reiniciar el
servidor, registrarse de nuevo, cerrar sesión y volver a entrar, los
4 000 000 000 000 702 seguían ahí.

La causa era más estructural: el saldo se guardaba en la clave `snail.saldo`,
**una sola clave para toda la aplicación**. Eso rompía en dos direcciones:

1. El saldo es un dato de la cuenta, no del navegador. Con una clave global,
   dos cuentas distintas abiertas en el mismo navegador compartían la misma
   billetera.
2. Al cerrar sesión el valor se conservaba a propósito, así que un saldo
   corrupto sobrevivía indefinidamente y reaparecía en cada inicio de sesión.

La corrección indexa la clave por identificador de usuario
(`snail.saldo.<id>`), con lo que cada cuenta tiene su propio saldo y solo lo
recupera al entrar en ella. Además, `leerSaldo` dejó de aceptar cualquier
número: como LocalStorage es editable a mano, un valor leído de ahí no es un
dato creíble. Ahora se descarta lo que no sea un entero entre 0 y mil millones,
que es un techo holgado (alcanzarlo exigiría cien mil recargas). La clave global
antigua se elimina en la migración.

Las pruebas que fijan este comportamiento son dos: dos cuentas en el mismo
navegador no comparten saldo, y un saldo absurdo se descarta en lugar de
mostrarse como dinero.

## 7. Decisiones de diseño

### Contraseñas
Se hashean con **bcrypt** (`bcryptjs`), nunca en texto plano. Bcrypt es lento a
propósito: ese costo es lo que vuelve inviable la fuerza bruta. Genera un *salt*
aleatorio por hash, de modo que dos usuarios con la misma contraseña producen
hashes distintos. En producción se evaluaría argon2; se eligió bcryptjs porque es
JavaScript puro y no requiere compilación nativa.

El login devuelve el **mismo mensaje** para "correo inexistente" y "contraseña
incorrecta", y ejecuta una comparación bcrypt en ambos casos. Si los mensajes
difieran, un atacante podría enumerar los correos registrados.

### Sesión y persistencia
El token viaja en la cabecera `Authorization`, nunca en la URL. Al recargar, el
cliente consulta `GET /api/auth/me` para confirmar que el token guardado siga
siendo válido; si el servidor responde `401`, se descarta la sesión. Confiar solo
en LocalStorage dejaría al usuario con una sesión fantasma tras reiniciar el
servidor.

### Almacenamiento

| Dato | Dónde | Motivo |
| --- | --- | --- |
| Token, usuario, saldo | LocalStorage | Lo exige el enunciado; `sessionStorage` se borra al cerrar la pestaña |
| Contraseña | **En ningún lado** | No se persiste, ni en claro ni hasheada |
| Tarjeta y CVV | LocalStorage | Requisito explícito del enunciado |

**Riesgo asumido:** LocalStorage es accesible desde cualquier script de la
página, de modo que un XSS podría leer el token y la tarjeta. Es una limitación
del enfoque pedido. En un sistema real, el CVV nunca se almacenaría (lo prohíben
los PCI DSS) y el saldo viviría en el servidor, no en el navegador.

### Datos simulados
Las carreras se generan con un PRNG **determinista** (mulberry32) a partir de la
semilla `semilla-2026`. La misma semilla produce siempre el mismo día. Esto hace
que los datos sean verificables a mano y que las pruebas no fallen de forma
aleatoria.

### Sistema visual
La interfaz sigue cinco reglas, aplicadas por igual en el acceso, el dashboard y
el modal de recarga:

1. **Cero radio de esquina.** Todo es anguloso salvo los círculos, que cumplen una
   función concreta: avatar, símbolo de marca, anillo y punto de estado.
2. **Sombras como bloque desplazado** (`6px 6px 0`, y `12px 12px 0` en el modal).
   El panel se apoya sobre la mesa en lugar de flotar encima.
3. **Campos subrayados, no cajas.** El dato se escribe sobre un filete de 2 px. Se
   usa la misma anatomía en el login y en el pago, de modo que no hay dos
   formularios distintos dentro de la misma aplicación.
4. **Una sola familia de color.** No hay color de acento: la jerarquía sale del
   valor (claro/oscuro) y de los filetes. El único color funcional es el rojo de
   rechazo.
5. **Etiquetas en versalitas de 8 a 11 px** con `0.14em` de espaciado, que es el
   acento tipográfico que hace que la pantalla se lea como un cartel.

La paleta completa son cinco valores: `#1d2d44` (navy), `#3f5c76` (acero),
`#8aa9c4` (acero medio), `#c9dce8` (acero pálido) y `#eaf2f8` (hielo).

**Dos elementos del diseño de referencia que no se copiaron, a propósito.** El
diseño original incluía un botón *Participar en próxima carrera* con hora y
lugar, y una tabla de resultados por carrera. El enunciado prohíbe construir una
sección para realizar apuestas y una lógica para ejecutar carreras, así que
ambos se descartaron. El bloque de apertura del dashboard conserva el antetítulo,
el titular grande y la línea de apoyo, pero termina en el gráfico: no hay nada
que pulsar.

### Manejo de errores y timeout

Todo el tráfico del cliente pasa por una única función, que concentra cuatro
casos que de otro modo habría que repetir en cada pantalla:

| Situación | Código | Qué ve el usuario |
| --- | --- | --- |
| El servidor no responde en 15 s | `TIMEOUT` | «El servidor tardo demasiado en responder.» |
| Servidor caído o sin red | `NETWORK_ERROR` | «No se pudo conectar con el servidor.» |
| El servidor responde con error | código de SnailPay | El `status_detail` que él envió |
| Sesión caducada (401) | `AUTH_EXPIRED` | Cierre de sesión automático |

Los dos primeros están **separados a propósito**: un servidor caído y un
servidor lento son fallos distintos y una interfaz honesta los explica
distinto. El corte de los 15 s usa `AbortController`, y el temporizador se
limpia en un `finally` para que una respuesta rápida no deje un temporizador
vivo. El límite es holgado a propósito porque SnailPay es un mock local y
responde en milisegundos: 15 s solo se agotan ante un problema real.

## 8. Pruebas

66 pruebas automatizadas:

- **Autenticación (8):** hash con prefijo bcrypt, sales distintos para la misma
  contraseña, correo único sin distinción de mayúsculas, rechazo de credenciales
  incorrectas, mensaje de error uniforme, ciclo de vida del token, y que el hash
  nunca salga en la respuesta pública.
- **Carreras (7):** 6 caracoles, 6 carreras, un ganador válido por carrera, ids
  únicos, determinismo por semilla, y que el total de victorias coincida con el
  número de carreras.
- **SnailPay (21):** los tres escenarios, los 11 campos de la respuesta, que
  ningún fallo emita código de autorización, el rango del monto (máximo,
  mínimo, decimal, no finito, y un número de tarjeta escrito en el campo), y
  que el formato de entrada no altere el veredicto: la tarjeta de éxito se
  acepta con guiones o espacios, y las de rechazo y de caída se detectan
  igual.
- **Interfaz (26):** porcentajes del anillo que suman 100, persistencia del saldo,
  que un fallo **no** modifique el saldo, que un éxito sí lo aumente, el bloqueo
  de montos inválidos sin llegar a llamar a la API, que la ruta protegida no
  muestre el dashboard sin sesión, el aislamiento del saldo entre dos cuentas
  del mismo navegador, el recorte de un saldo fuera de rango (valores no
  numéricos, negativos o decimales a `0`; valores por encima del tope al tope),
  el cierre automático del modal solo en el escenario aprobado, la supervivencia
  del código de autorización fuera del diálogo, que el diálogo **no** se cierre
  ante un rechazo, el formateo automático del vencimiento (`1226` → `12/26`) y
  el de la tarjeta (`1226` → `12/26`, `12341234…` → `1234-1234-…`), incluido
  que el guion **no** viaje en el payload.
- **Timeout (4):** que una petición colgada se corte a los 15 s y reporte un
  código `TIMEOUT` distinguible de `NETWORK_ERROR`, que un servidor caído siga
  reportando fallo de red y no se disfrace de timeout, y que una respuesta
  rápida no deje el temporizador vivo.

## 9. Estructura

```
shared/   Contratos y tipos compartidos entre cliente y servidor
server/
  src/
    data/        Almacenamiento en memoria
    middleware/  Autenticación y manejo centralizado de errores
    routes/      Rutas HTTP, sin lógica de negocio
    services/    Lógica: auth, carreras, SnailPay
    validation/  Esquemas Zod
client/
  src/
    components/
      atoms/     Button, Card, Input, Label
      molecules/  FormField, BalanceCard, ChartCard
      organisms/  AuthForm, SnailPayForm, BetStatsPanel, SnailLeaderboard
      templates/  AuthLayout, DashboardLayout
    context/     AuthProvider y useAuth
    pages/       Login, Register, Dashboard
    services/    Cliente HTTP y LocalStorage
```

El cliente sigue **Atomic Design**: los átomos no conocen el contexto, y cada
capa solo depende de la anterior.

## 10. Alcance

Las apuestas y la ejecución de carreras **no están implementadas**: el
enunciado las excluye. El anillo de victorias/derrotas muestra datos simulados
derivados de la misma semilla que las carreras, para que ambos gráficos sean
coherentes entre sí.

## 11. Uso de asistencia automatizada

Se usaron dos herramientas de inteligencia artificial:

- **v0, de Vercel** — generó un diseño de referencia con sus pantallas y su
  estilo. Se tomó como guía de apariencia y la interfaz se reimplementó por
  completo en React con Vite: ninguno de sus archivos ni de sus dependencias
  está en el proyecto.
- **OpenCode** — asistente de código en la terminal, empleado para desarrollar
  el resto del código de la aplicación, incluida la hoja de estilos
  (`client/src/styles/global.css`, 1007 líneas, sin ningún framework), además
  de la revisión del código, la documentación y este README.

La arquitectura, las decisiones de seguridad y las pruebas se definieron de forma
explícita y están documentadas en los puntos 7 y 8 de este README y en los
comentarios del código. Cada sugerencia se verificó con una prueba automatizada o
se contrastó con el enunciado antes de aceptarse.

