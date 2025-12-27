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
1. Configurar variables de entorno:
	- Copiar `.env.example` a `.env` en la raíz del proyecto
	- Ajustar variables si es necesario (por defecto usa `STORAGE_TYPE=hybrid`)
2. Levantar servicios:
	- `docker compose up -d`
3. Frontend en `http://localhost:3000` y API en `http://localhost:8000`.
4. Enviar consulta desde el panel VR y observar:
	- Contador en el Orchestrator.
	- Respuesta general arriba del Orchestrator.
	- Respuestas por agente bajo cada esfera con su tiempo.

## Características implementadas
- Orquestación multi-agente vía FastAPI con arquitectura modular (Nest-like).
- **Gestión de Agentes** con persistencia en `registry.json`:
  - ✅ Crear, listar, actualizar agentes (llama3.2, codellama, mistral)
  - ✅ Feedback en tiempo real con eventos frontend-backend
  - ✅ Logs detallados para debugging (`localStorage.getItem('api_debug_logs')`)
  - ✅ Endpoint de verificación `/agents/verify/{id}` para testing
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

## Documentación

- **[Guía Rápida](Docs/QUICKSTART.md)**: Setup y desarrollo local
- **[Referencia Rápida](Docs/QUICKREF.md)**: Mapa de arquitectura del proyecto
- **[Creación de Agentes](Docs/GUIA_CREACION_AGENTES.md)**: Guía completa del flujo de agentes
- **[Análisis de Agentes](Docs/ANALISIS_CREACION_AGENTES.md)**: Diagnóstico técnico del sistema
- **[Script de Testing](Scripts/test-agent-creation.ps1)**: Pruebas automatizadas de persistencia
