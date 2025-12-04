// Configuración de la aplicación VR
export const CONFIG = {
    // API Configuration
    API_BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
    API_TIMEOUT: 180000,
    RETRY_ATTEMPTS: 5,
    RETRY_DELAY: 3000,
    
    // WebSocket Configuration
    WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws',
    WS_RECONNECT_INTERVAL: 3000,
    WS_MAX_RECONNECT_ATTEMPTS: 5,
    
    // Orchestrator Configuration
    ORCHESTRATOR: {
        position: { x: 0, y: 0.0, z: -8 }, // Posición del orquestador agentes en el espacio VR
        radius: 2,
        color: '#070142',
        pulseSpeed: 2000,
        particleCount: 500
    },
    
    // Agent Configuration
    AGENTS: {
        orbitRadius: 6,
        orbitSpeed: 0.1,
        sphereRadius: 0.5,
        colors: {
            'llama3.2': '#4A90E2',
            'codellama': '#E24A4A',
            'mistral': '#9B59B6',
            'default': '#FFFFFF'
        },
        statusColors: {
            idle: '#4CAF50',
            processing: '#FFC107',
            error: '#F44336',
            offline: '#9E9E9E'
        }
    },
    
    // UI Configuration
    UI: {
        panelDistance: 3,
        panelHeight: 2,
        textScale: 1.5,
        fadeInDuration: 700,
        fadeOutDuration: 500
    },
    
    // Status Messages
    MESSAGES: {
        connecting: 'Conectando con el orquestador...',
        connected: 'Conectado al orquestador',
        disconnected: 'Desconectado del servidor',
        error: 'Error de conexión',
        noAgents: 'No hay agentes disponibles',
        loadingAgents: 'Cargando agentes...',
        createAgent: 'Crear nuevo agente',
        sendQuery: 'Enviar consulta'
    },
    
    // Mock Data (para desarrollo sin API)
    MOCK_MODE: false,  // Cambiar a true para usar datos de prueba sin API
    MOCK_DATA: {
        agents: [
            {
                id: 'agent-code-analyzer',
                name: 'Code Analyzer',
                model: 'codellama',
                status: 'idle',
                capabilities: ['code_review', 'bug_detection', 'refactoring'],
                port: 8101
            },
            {
                id: 'agent-data-analyst',
                name: 'Data Analyst',
                model: 'mistral',
                status: 'idle',
                capabilities: ['data_analysis', 'statistics', 'insights'],
                port: 8102
            },
            {
                id: 'agent-conversation',
                name: 'Conversation',
                model: 'llama3.2',
                status: 'idle',
                capabilities: ['chat', 'qa', 'assistance'],
                port: 8103
            }
        ]
    }
};

export default CONFIG;
