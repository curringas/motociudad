## ADDED Requirements

### Requirement: Moderación síncrona en la publicación

El sistema SHALL moderar cada comentario en el momento de publicarlo, dentro de la
Edge Function de publicación y antes de que el comentario sea público. La
moderación SHALL ejecutar primero pre-filtros deterministas (enlaces/URLs,
flood/repetición, mayúsculas excesivas) y, si no descartan el comentario, SHALL
consultar a un proveedor de IA que devuelve un veredicto. El texto enviado al
proveedor SHALL limitarse al cuerpo del comentario; NO SHALL incluirse
geolocalización ni datos de cuenta del usuario. La clave del proveedor SHALL
residir en un secret de servidor y NO SHALL exponerse nunca en el cliente.

#### Scenario: Pre-filtro descarta enlace sin llamar a la IA

- **WHEN** un usuario envía un comentario que contiene una URL o enlace
- **THEN** el pre-filtro lo rechaza como spam sin invocar al proveedor de IA y el
  comentario no se crea

#### Scenario: Comentario limpio pasa al proveedor

- **WHEN** un comentario supera los pre-filtros
- **THEN** el sistema solicita un veredicto al proveedor de IA enviando únicamente
  el cuerpo del comentario

### Requirement: Veredicto estructurado del proveedor

El proveedor SHALL devolver un veredicto estructurado con `decision`
(`allow` | `reject` | `flag`), `categories`, `reason_es` (motivo legible en es-ES)
y `confidence`. El sistema SHALL validar el veredicto contra un esquema; si el
veredicto no cumple el esquema, SHALL tratarse como fallo de validación (revisión
humana). El cuerpo del comentario SHALL enviarse como dato delimitado y NO SHALL
concatenarse como instrucción, para resistir inyección de prompt.

#### Scenario: Veredicto allow publica el comentario

- **WHEN** el proveedor devuelve `decision: "allow"`
- **THEN** el comentario se crea con estado `approved` y queda visible

#### Scenario: Veredicto reject no crea el comentario

- **WHEN** el proveedor devuelve `decision: "reject"`
- **THEN** el sistema no crea el comentario y responde con un motivo legible en
  es-ES para el usuario

#### Scenario: Veredicto flag deja el comentario en revisión

- **WHEN** el proveedor devuelve `decision: "flag"`
- **THEN** el comentario se crea con estado `pending_review`, no se acreditan
  Octanos y se informa al usuario de que queda pendiente de revisión

#### Scenario: Veredicto no parseable cae a revisión

- **WHEN** el proveedor devuelve una respuesta que no cumple el esquema del
  veredicto
- **THEN** el sistema trata el resultado como fallo y deja el comentario en
  `pending_review`

### Requirement: Reglas de contenido de moderación

El proveedor SHALL rechazar (`reject`) contenido con: insultos dirigidos, acoso u
odio; spam o publicidad; contenido sexual o violento explícito; datos personales
(teléfonos, matrículas, nombres de personas, direcciones exactas); instrucciones
ilegales o peligrosas; y contenido fuera de tema. Un comentario SHALL considerarse
fuera de tema (`offtopic`) cuando NO aporte información sobre el parking comentado
(ubicación, acceso, seguridad, capacidad/espacio, precio, iluminación, horario o la
experiencia de aparcar allí); hablar de la propia moto sin relación con aparcar en
ese parking, los saludos y la charla personal SHALL rechazarse aunque mencionen
motos. Mencionar la moto SHALL permitirse solo cuando sea en relación con aparcar en
ese parking. El sistema NO SHALL rechazar la crítica negativa honesta sobre el
parking: una opinión desfavorable pero respetuosa SHALL permitirse (`allow`).

#### Scenario: Datos personales rechazados

- **WHEN** un comentario incluye un teléfono, una matrícula o una dirección exacta
- **THEN** el veredicto es `reject` con categoría `pii` y el comentario no se crea

#### Scenario: Off-topic rechazado

- **WHEN** un comentario no aporta información sobre el parking (p. ej. describe o
  presume de la propia moto, un saludo o charla personal), aunque mencione motos
- **THEN** el veredicto es `reject` con categoría `offtopic` y el comentario no se
  crea

#### Scenario: Mención de la moto en relación con aparcar permitida

- **WHEN** un comentario menciona la moto en relación con aparcar en ese parking
  (p. ej. "cabe mi custom sin problema")
- **THEN** el veredicto es `allow` y el comentario se publica

#### Scenario: Crítica negativa honesta permitida

- **WHEN** un comentario expresa una opinión desfavorable pero respetuosa sobre el
  parking (p. ej. "zona insegura, mejor no dejar la moto aquí")
- **THEN** el veredicto es `allow` y el comentario se publica

### Requirement: Fail-safe a revisión humana

El sistema SHALL crear el comentario con estado `pending_review` para moderación
humana cuando la moderación no pueda completarse (el proveedor no responde, agota
el timeout, o devuelve un resultado inválido), e informar al usuario. En ese caso
el sistema NO SHALL aprobar el comentario por defecto ni rechazarlo por defecto, y
NO SHALL acreditar Octanos mientras el comentario siga en `pending_review`.

#### Scenario: Proveedor caído o timeout

- **WHEN** el proveedor de IA no responde o se agota el timeout durante la
  publicación
- **THEN** el comentario se crea con estado `pending_review`, sin Octanos, y el
  usuario recibe el aviso de que queda pendiente de revisión

### Requirement: Estados de moderación y visibilidad

Cada comentario SHALL tener un estado de moderación (`approved` |
`pending_review` | `rejected`). El listado público de un parking SHALL mostrar
únicamente comentarios `approved` (no borrados). El autor SHALL poder ver sus
propios comentarios en `pending_review`. Los comentarios `rejected` NO SHALL
listarse para ningún usuario no administrador. La tabla SHALL tener RLS activa que
haga cumplir esta visibilidad, con cobertura pgTAP.

#### Scenario: Público solo ve aprobados

- **WHEN** un usuario cualquiera abre el detalle de un parking
- **THEN** ve solo los comentarios `approved` y no los `pending_review` de otros ni
  ningún `rejected`

#### Scenario: Autor ve su comentario en revisión

- **WHEN** el autor de un comentario en `pending_review` abre el detalle del parking
- **THEN** ve su propio comentario marcado como pendiente de revisión

#### Scenario: RLS impide leer comentarios ocultos de terceros

- **WHEN** un cliente autenticado intenta leer directamente comentarios
  `pending_review` o `rejected` de otro autor
- **THEN** RLS deniega el acceso a esas filas

### Requirement: Cola de moderación en el panel de administración

El panel de administración (solo web) SHALL listar los comentarios en
`pending_review` y SHALL permitir a un administrador aprobarlos o rechazarlos. El
cambio de estado SHALL realizarse exclusivamente vía Edge Function con
`service_role` y verificación de rol admin; el cliente NO SHALL cambiar el estado
de moderación directamente. Al aprobar, el sistema SHALL evaluar la acreditación
de Octanos del comentario.

#### Scenario: Admin aprueba un comentario pendiente

- **WHEN** un administrador aprueba un comentario en `pending_review`
- **THEN** el comentario pasa a `approved`, queda visible y se evalúa su
  acreditación de Octanos

#### Scenario: Admin rechaza un comentario pendiente

- **WHEN** un administrador rechaza un comentario en `pending_review`
- **THEN** el comentario pasa a `rejected`, deja de listarse y no acredita Octanos

#### Scenario: No admin no puede moderar

- **WHEN** un usuario sin rol admin intenta cambiar el estado de moderación de un
  comentario
- **THEN** la operación se deniega
