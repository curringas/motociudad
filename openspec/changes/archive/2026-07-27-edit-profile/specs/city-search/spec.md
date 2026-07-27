## ADDED Requirements

### Requirement: Búsqueda de ciudades por texto
El sistema SHALL exponer una Edge Function `city-search` que, dada una consulta de texto,
devuelva una lista de sugerencias de ciudades estructuradas. Cada sugerencia MUST incluir el
nombre de la ciudad, la región/estado (si aplica), el país, el código de país y las
coordenadas (latitud/longitud), además de una etiqueta canónica lista para mostrar y guardar
("Ciudad, País"). La búsqueda MUST cubrir ciudades de cualquier país, no solo España.

#### Scenario: Consulta con resultados
- **WHEN** se llama a `city-search` con "malaga"
- **THEN** devuelve una o más sugerencias, incluyendo "Málaga, España" con sus coordenadas

#### Scenario: Ciudad internacional
- **WHEN** se llama a `city-search` con "berlin"
- **THEN** devuelve sugerencias fuera de España (p. ej. "Berlín, Alemania")

#### Scenario: Consulta demasiado corta
- **WHEN** se llama a `city-search` con menos de 2 caracteres
- **THEN** devuelve una lista vacía sin llamar al geocodificador externo

#### Scenario: Sin coincidencias
- **WHEN** se llama a `city-search` con un texto que no corresponde a ninguna ciudad
- **THEN** devuelve una lista vacía

### Requirement: Acceso autenticado y validación de entrada
La Edge Function `city-search` SHALL requerir un usuario autenticado y validar la entrada con
Zod. La clave o credenciales del geocodificador (si las hubiera) MUST permanecer en el
servidor y nunca exponerse al cliente.

#### Scenario: Llamada sin autenticación
- **WHEN** se llama a `city-search` sin sesión válida
- **THEN** la función responde con error de autorización

#### Scenario: Entrada inválida
- **WHEN** se llama a `city-search` con un cuerpo que no cumple el esquema
- **THEN** la función responde con error de validación

### Requirement: Resultado multiplataforma consistente
El sistema SHALL producir el mismo formato de sugerencias con independencia de la plataforma
del cliente (web, iOS, Android), sin depender del geocodificador nativo del sistema operativo.

#### Scenario: Misma respuesta en web y móvil
- **WHEN** el cliente web y el cliente móvil llaman a `city-search` con la misma consulta
- **THEN** ambos reciben sugerencias en el mismo formato estructurado
