# Carreras de Caracoles

AplicaciÃ³n full-stack de demostraciÃ³n: registro e inicio de sesiÃ³n, dashboard
protegido con saldo, recarga mediante una pasarela simulada y visualizaciÃ³n de
un dÃ­a de carreras.

**Stack:** React 18 + TypeScript (Vite) Â· Express + TypeScript Â· LocalStorage Â· Vitest

---

## 1. Requisitos

- Node.js 20 o superior (probado en 24.12)
- npm 10 o superior

## 2. InstalaciÃ³n

```bash
npm install
```

## 3. CÃ³mo ejecutar

Se necesitan **dos terminales**, porque son dos procesos distintos.

**Terminal 1 â€” servidor (API en el puerto 4000):**

```bash
npm run dev:server
```

**Terminal 2 â€” cliente (interfaz en el puerto 5173):**

```bash
npm run dev:client
```

Abrir <http://localhost:5173>.

> En PowerShell, `curl` es un alias de `Invoke-WebRequest`. Para probar la API
> usa `Invoke-RestMethod http://localhost:4000/api/health` en lugar de `curl`.

## 4. VerificaciÃ³n

```bash
npm run typecheck   # revisiÃ³n de tipos de cliente y servidor
npm run test        # 47 pruebas automatizadas
npm run build       # compilaciÃ³n de producciÃ³n
npm run test:all    # los tres, en orden
```

## 5. Endpoints de la API

| MÃ©todo | Ruta | Acceso | DescripciÃ³n |
| --- | --- | --- | --- |
| `GET` | `/api/health` | pÃºblico | ComprobaciÃ³n de disponibilidad |
| `POST` | `/api/auth/register` | pÃºblico | Crear cuenta, abre sesiÃ³n |
| `POST` | `/api/auth/login` | pÃºblico | Iniciar sesiÃ³n |
| `POST` | `/api/auth/logout` | sesiÃ³n | Invalidar el token |
| `GET` | `/api/auth/me` | sesiÃ³n | Verificar si el token sigue vÃ¡lido |
| `GET` | `/api/races/today` | pÃºblico | DÃ­a simulado (6 carreras) |
| `POST` | `/api/snailpay/charge` | sesiÃ³n | Recargar saldo |
| `POST` | `/api/snailpay/simulate-outage` | sesiÃ³n | Activar el escenario de caÃ­da |
| `POST` | `/api/snailpay/restore` | sesiÃ³n | Restaurar el servicio |

Las rutas marcadas como *sesiÃ³n* exigen la cabecera
`Authorization: Bearer <token>`. Sin ella devuelven `401`.

## 6. Datos de prueba de SnailPay

| Dato | Valor |
| --- | --- |
| Tarjeta vÃ¡lida | `1234123412341234` |
| Vencimiento | `12/26` |
| CVV | `543` |
| Nombre | cualquiera no vacÃ­o |
| Monto | entero entre `1` y `10 000` |

### Escenarios

| # | CÃ³mo dispararlo | `status` | HTTP | `authorization_code` |
| --- | --- | --- | --- | --- |
| 1 | Tarjeta vÃ¡lida | `approved` | 200 | `SNP-OK` |
| 2 | `4000000000000002`, o cualquier dato invÃ¡lido | `declined` | 402 | `null` |
| 3 | `POST /api/snailpay/simulate-outage`, o tarjeta `0000000000000000` | `error` | 503 | `null` |

En los escenarios 2 y 3 **el saldo no se modifica**. La garantÃ­a estÃ¡ en
`client/src/components/organisms/SnailPayForm.tsx`: el saldo solo aumenta dentro
de `if (respuesta.status === 'approved')`.

### ValidaciÃ³n en tres capas del monto

El monto se valida en tres sitios, y cada uno tiene un propÃ³sito distinto:

1. **Atributos `min`/`max` del input** â€” primera barrera en el navegador.
2. **`validarMonto()` en el componente** â€” feedback inmediato, con estilos.
3. **Zod y el servicio, en el servidor** â€” la Ãºnica capa que no se puede saltar.

El formulario lleva `noValidate` a propÃ³sito. Sin eso, el navegador bloquearÃ­a
el envÃ­o con su propia burbuja y la validaciÃ³n de la aplicaciÃ³n nunca se
ejecutarÃ­a, dejando al usuario con un aviso del sistema en vez del mensaje
accesible de la app.

### LÃ­mite superior del monto: un bug real

La primera versiÃ³n validaba el monto solo como Â«mayor que ceroÂ». Durante una
prueba manual se tecleÃ³ por error un nÃºmero de tarjeta en el campo de monto, y
la pasarela aprobÃ³ una recarga de **4 000 000 000 000 702**, dejando el saldo en
esa cifra.

El monto no es un entero cualquiera: es dinero. Sin un techo, cualquier valor
absurdo pasa por ser positivo. La correcciÃ³n aÃ±ade un rango cerrado
(`MONTO_MINIMO` / `MONTO_MAXIMO`), y hay pruebas de regresiÃ³n para los tres casos
que lo permitÃ­an: nÃºmero de tarjeta en el campo, monto decimal y monto no
finito.

## 7. Decisiones de diseÃ±o

### ContraseÃ±as
Se hashean con **bcrypt** (`bcryptjs`), nunca en texto plano. Bcrypt es lento a
propÃ³sito: ese costo es lo que vuelve inviable la fuerza bruta. Genera un *salt*
aleatorio por hash, de modo que dos usuarios con la misma contraseÃ±a producen
hashes distintos. En producciÃ³n se evaluarÃ­a argon2; se eligiÃ³ bcryptjs porque es
JavaScript puro y no requiere compilaciÃ³n nativa.

El login devuelve el **mismo mensaje** para "correo inexistente" y "contraseÃ±a
incorrecta", y ejecuta una comparaciÃ³n bcrypt en ambos casos. Si los mensajes
difieran, un atacante podrÃ­a enumerar los correos registrados.

### SesiÃ³n y persistencia
El token viaja en la cabecera `Authorization`, nunca en la URL. Al recargar, el
cliente consulta `GET /api/auth/me` para confirmar que el token guardado siga
siendo vÃ¡lido; si el servidor responde `401`, se descarta la sesiÃ³n. Confiar solo
en LocalStorage dejarÃ­a al usuario con una sesiÃ³n fantasma tras reiniciar el
servidor.

### Almacenamiento

| Dato | DÃ³nde | Motivo |
| --- | --- | --- |
| Token, usuario, saldo | LocalStorage | Lo exige el enunciado; `sessionStorage` se borra al cerrar la pestaÃ±a |
| ContraseÃ±a | **En ningÃºn lado** | No se persiste, ni en claro ni hasheada |
| Tarjeta y CVV | LocalStorage | Requisito explÃ­cito del enunciado |

**Riesgo asumido:** LocalStorage es accesible desde cualquier script de la
pÃ¡gina, de modo que un XSS podrÃ­a leer el token y la tarjeta. Es una limitaciÃ³n
del enfoque pedido. En un sistema real, el CVV nunca se almacenarÃ­a (lo prohÃ­ben
los PCI DSS) y el saldo vivirÃ­a en el servidor, no en el navegador.

### Datos simulados
Las carreras se generan con un PRNG **determinista** (mulberry32) a partir de la
semilla `semilla-2026`. La misma semilla produce siempre el mismo dÃ­a. Esto hace
que los datos sean verificables a mano y que las pruebas no fallen de forma
aleatoria.

## 8. Pruebas

47 pruebas automatizadas:

- **AutenticaciÃ³n (8):** hash con prefijo bcrypt, sales distintos para la misma
  contraseÃ±a, correo Ãºnico sin distinciÃ³n de mayÃºsculas, rechazo de credenciales
  incorrectas, mensaje de error uniforme, ciclo de vida del token, y que el hash
  nunca salga en la respuesta pÃºblica.
- **Carreras (7):** 6 caracoles, 6 carreras, un ganador vÃ¡lido por carrera, ids
  Ãºnicos, determinismo por semilla, y que el total de victorias coincida con el
  nÃºmero de carreras.
- **SnailPay (18):** los tres escenarios, los 11 campos de la respuesta, que
  ningÃºn fallo emita cÃ³digo de autorizaciÃ³n, y el rango del monto (mÃ¡ximo,
  mÃ­nimo, decimal, no finito, y un nÃºmero de tarjeta escrito en el campo).
- **Cliente (14):** porcentajes del anillo que suman 100, persistencia del saldo,
  que un fallo **no** modifique el saldo, que un Ã©xito sÃ­ lo aumente, el bloqueo
  de montos invÃ¡lidos sin llegar a llamar a la API, y que la ruta protegida no
  muestre el dashboard sin sesiÃ³n.

## 9. Estructura

```
shared/   Contratos y tipos compartidos entre cliente y servidor
server/
  src/
    data/        Almacenamiento en memoria
    middleware/  AutenticaciÃ³n y manejo centralizado de errores
    routes/      Rutas HTTP, sin lÃ³gica de negocio
    services/    LÃ³gica: auth, carreras, SnailPay
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

El cliente sigue **Atomic Design**: los Ã¡tomos no conocen el contexto, y cada
capa solo depende de la anterior.

## 10. Alcance

Las apuestas y la ejecuciÃ³n de carreras **no estÃ¡n implementadas**: el
enunciado las excluye. El anillo de victorias/derrotas muestra datos simulados
derivados de la misma semilla que las carreras, para que ambos grÃ¡ficos sean
coherentes entre sÃ­.

## 11. Uso de asistencia automatizada

Este proyecto se desarrollÃ³ con ayuda de un asistente de IA para escribir el
cÃ³digo, explicar las decisiones y redactar la documentaciÃ³n. La arquitectura, las
decisiones de seguridad y las pruebas se definieron de forma explÃ­cita y estÃ¡n
documentadas en los puntos 7 y 8 de este README y en los comentarios del cÃ³digo.

