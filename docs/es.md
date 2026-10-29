# Claude AI

Esta integración convierte a **Claude**, la IA de Anthropic, en el cerebro del
asistente de Gladys. Una vez elegida, responde a todas las peticiones de IA de
su Gladys: el chat (y los dispositivos que controla por usted), la
clasificación de sus mensajes, la acción de escena **Preguntar a la IA** y el
resumen semanal.

Es una integración de la comunidad: no la hace ni la mantiene Anthropic.

## Antes de empezar

- **Gladys 5.3 o posterior.**
- **Una clave de API de Anthropic.** Cree una cuenta en
  [console.anthropic.com](https://console.anthropic.com), añada crédito o un
  medio de pago y luego cree una clave en **Settings → API keys**. Empieza por
  `sk-ant-`.
- El uso lo **factura Anthropic**, por token, al precio del modelo elegido.
  No hace falta Gladys Plus.

Claude funciona en la nube (`api.anthropic.com`): Gladys necesita acceso a
Internet.

## Configuración

1. Instale la integración desde el catálogo y abra su pestaña
   **Configuración**.
2. Pegue su **clave de API de Anthropic** y guarde.
3. Haga clic en **Probar la conexión**: cada modelo responde a una pregunta de
   una palabra y el tiempo empleado se muestra bajo el botón.
4. Vaya a **Ajustes → Inteligencia artificial** y elija **Claude AI** como
   proveedor de IA.

El estado en la parte superior de la pantalla de configuración se pone en
verde cuando la clave es aceptada y los modelos elegidos están abiertos para
ella. En rojo, indica el motivo.

## Los ajustes

| Ajuste                                    | Qué hace                                                                                                                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clave de API de Anthropic                 | Su clave. Se queda en Gladys, nunca se vuelve a mostrar ni se escribe en los registros.                                                                                                                     |
| Modelo del chat                           | Responde al chat, crea las escenas, redacta el resumen semanal. **Claude Opus 5.5** por defecto. Sonnet 5.5 es más rápido y barato, Fable 5.1 el más potente y el más caro.                                 |
| Modelo del enrutador                      | Clasifica cada mensaje antes de la respuesta. Gladys lo espera **20 segundos** como máximo: mantenga un modelo rápido, **Claude Haiku 5.5** por defecto.                                                    |
| Esfuerzo de razonamiento                  | Cuánto piensa el modelo del chat antes de responder: bajo, medio (por defecto), alto, muy alto. Más esfuerzo ayuda en las peticiones difíciles (crear una escena), pero responde más despacio y cuesta más. |
| Longitud máxima de una respuesta (tokens) | El presupuesto de salida de una respuesta, razonamiento incluido. 16 000 por defecto. Auméntelo si los registros indican que una respuesta ha alcanzado `max_tokens`.                                       |

## Lo que ve Claude

Elegir un proveedor de IA es una decisión de privacidad. El proveedor recibe:

- cada mensaje del chat y el historial de la conversación;
- la descripción de las herramientas que Gladys le ofrece, y sus resultados —
  el estado de los dispositivos que consulta;
- las imágenes que envía en el chat.

Sus respuestas controlan sus dispositivos y crean sus escenas. Lea la
[política de privacidad de Anthropic](https://www.anthropic.com/legal/privacy)
antes de elegirlo.

## Costes y velocidad

- El prompt del sistema y la lista de herramientas se repiten en cada mensaje:
  la integración pide a Anthropic que los **guarde en caché**, lo que los
  factura a una fracción del precio después del primer mensaje.
- El enrutador siempre funciona con esfuerzo bajo en el modelo del enrutador:
  es la petición que se envía con más frecuencia.
- Para gastar menos, elija **Claude Sonnet 5.5** para el chat o baje el
  esfuerzo.
- Cuando Claude rechaza una petición por motivos de seguridad, Anthropic la
  repite con su modelo de respaldo por defecto en la misma llamada; si todos
  los modelos la rechazan, el asistente responde que no puede ayudar.

## Solución de problemas

- **«Anthropic ha rechazado la clave de API»** — la clave es incorrecta, está
  revocada o pertenece a una organización sin crédito. Cree una nueva y
  péguela de nuevo.
- **«… no está disponible para esta clave de API»** — su organización de
  Anthropic no tiene acceso a ese modelo: elija otro.
- **«Se ha alcanzado el límite de solicitudes»** — demasiadas peticiones para
  su nivel de uso de Anthropic: espere un momento o suba de nivel en la
  consola de Anthropic.
- **«No se puede acceder a api.anthropic.com»** — Gladys no tiene acceso a
  Internet, o un cortafuegos bloquea esa dirección.
- **El asistente dice que el proveedor de IA no está disponible** — abra la
  pestaña **Registros** de la integración: cada petición escribe allí una línea
  (modelo, tiempo, tokens) y cada fallo su motivo.
