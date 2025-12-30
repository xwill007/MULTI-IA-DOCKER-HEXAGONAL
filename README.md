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
  - ✅ Endpoint de sincronización `/agents/sync` para verificar estado
  - ✅ Botón "SYNC STATUS" en VR que consulta estado de sincronización
  - ✅ Auto-persistencia en `registry.json` al crear/actualizar/importar agentes
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

### Inicio Rápido
- **[Guía Rápida](Docs/QUICKSTART.md)**: Setup y desarrollo local
- **[Referencia Rápida](Docs/QUICKREF.md)**: Mapa de arquitectura del proyecto

### Persistencia y Sincronización de Agentes
- **[Guía de Persistencia](Docs/AGENT_PERSISTENCE_GUIDE.md)**: Cómo se guardan y sincronizan agentes (RECOMENDADO)
- **[Cheat Sheet de Agentes](Docs/QUICK_REFERENCE_AGENTS.md)**: Comandos rápidos y troubleshooting
- **[Flowchart de Persistencia](Docs/FLOWCHART_AGENT_PERSISTENCE.md)**: Diagramas ASCII del flujo
- **[Test Cases](Docs/TEST_CASES_PERSISTENCE.md)**: Suite de pruebas completa
- **[Changelog de Persistencia](Docs/CHANGELOG_AGENT_PERSISTENCE.md)**: Cambios en esta sesión

### Agentes Avanzado
- **[Creación de Agentes](Docs/GUIA_CREACION_AGENTES.md)**: Guía completa del flujo de agentes
- **[Análisis de Agentes](Docs/ANALISIS_CREACION_AGENTES.md)**: Diagnóstico técnico del sistema

### Automatización
- **[Script de Testing](Scripts/test-agent-creation.ps1)**: Pruebas automatizadas de persistencia
- **[Script de Persistencia](Scripts/test-agent-persistence.ps1)**: Test suite interactivo (NUEVO)
