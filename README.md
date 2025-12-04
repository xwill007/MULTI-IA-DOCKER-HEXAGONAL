# MULTI-IA-DOCKER-HEXAGONAL
Orquestador de IAs en arquitectura hexagonal con Docker.

## Estado actual
- Docker stack operativo con 3 modelos en Ollama (llama3.2, codellama, mistral).
- Timeout frontend aumentado a 3 minutos para evitar cortes prematuros.
- Orchestrator hub muestra respuesta general y un contador de tiempo transcurrido.
- Cada agente muestra su respuesta debajo de su esfera con tiempo individual `[Xs]`.
- Velocidades de rotación reducidas para lectura cómoda.
- Panel del ORCHESTRATOR ampliado (más ancho y wrap) para ver textos largos.
- `.gitignore` y `.dockerignore` agregados para evitar subir modelos/caches.

## Uso rápido
1. Levantar servicios:
	- `docker compose up -d`
2. Frontend en `http://localhost:3000` y API en `http://localhost:8000`.
3. Enviar consulta desde el panel VR y observar:
	- Contador en el Orchestrator.
	- Respuesta general arriba del Orchestrator.
	- Respuestas por agente bajo cada esfera con su tiempo.

## Características implementadas
- Orquestación multi-agente vía FastAPI.
- Integración con Ollama en Docker.
- UI VR con A-Frame (esferas de agentes + hub central).
- Manejo de timeouts y reintentos con backoff.
- Temporizador visible en el hub.
- Paneles de respuesta por agente + tiempos individuales.
- Panel del Orchestrator ampliado para textos largos.
- Animaciones ralentizadas para mejorar la lectura.
- `.gitignore` y `.dockerignore` para excluir archivos pesados.

## Próximos pasos
1. Persistencia de conversación (`conversation_id`) en backend + reenvío desde frontend.
2. Mejoras de notificaciones (persistencia más larga y estados).
3. Métricas por agente (color por tiempo: verde/amarillo/rojo).
4. Documentar endpoints y formato de respuesta.
5. Limpieza de historial git si hay modelos ya versionados.
