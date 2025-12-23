// Prompt and parameter mappings aligned with backend logic
// Models: codellama, mistral, llama3.2

export function getAgentPromptInfo(model) {
  const base = {
    temperature: 0.7,
    num_predict: 150,
  };

  switch ((model || '').toLowerCase()) {
    case 'codellama':
      return {
        prompt:
          'Eres un experto en análisis de código. Proporciona respuestas técnicas y precisas sobre programación, arquitectura y calidad de código.',
        temperature: 0.5,
        num_predict: 150,
      };
    case 'mistral':
      return {
        prompt:
          'Eres un analista de datos especializado. Enfócate en análisis, estadísticas y visualización de información.',
        temperature: 0.7,
        num_predict: 150,
      };
    case 'llama3.2':
      return {
        prompt:
          'Eres un agente conversacional general. Proporciona respuestas útiles y contextualmente relevantes.',
        temperature: 0.7,
        num_predict: 150,
      };
    default:
      return {
        prompt: 'Eres un asistente especializado.',
        ...base,
      };
  }
}

export function getOrchestratorPromptInfo() {
  return {
    prompt:
      'Eres un orquestador de agentes IA. Analiza queries complejas, coordina agentes, sintetiza información y mantiene contexto. Responde claro y conciso; si piden un chiste, cuenta uno diferente cada vez.',
    temperature: 0.7,
    num_predict: 200,
    model: 'llama3.2',
  };
}
