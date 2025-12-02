/**
 * Configuración central del frontend VR
 */

export const CONFIG = {
    // API Configuration
    API_BASE_URL: 'http://localhost:8000',
    API_TIMEOUT: 5000,
    API_RETRY_ATTEMPTS: 3,
    API_RETRY_DELAY: 2000,
    
    // Mock Mode (para desarrollo sin backend)
    MOCK_MODE: true,
    
    // Orchestrator Configuration
    ORCHESTRATOR: {
        color: '#FFD700',
        radius: 2,
        position: { x: 0, y: 2, z: -8 },
        pulseSpeed: 2000,
        particleCount: 200
    },
    
    // Agents Configuration
    AGENTS: {
        orbitRadius: 5,
        orbitSpeed: 0.2,
        sphereRadius: 0.8,
        colors: {
            'llama3.2': '#2196F3',
            'codellama': '#9C27B0',
            'mistral': '#FF5722',
            'default': '#4CAF50'
        },
        statusColors: {
            idle: '#4CAF50',
            processing: '#FF9800',
            error: '#F44336',
            disconnected: '#9E9E9E'
        }
    },
    
    // UI Configuration
    UI: {
        panelDistance: 5,
        panelHeight: 2,
        notificationDuration: 3000
    },
    
    // Mock Data (para testing sin backend)
    MOCK_DATA: {
        agents: [
            {
                id: 'agent-001',
                name: 'Code Analyzer',
                model: 'codellama',
                status: 'idle',
                capabilities: ['code-review', 'analysis', 'refactoring'],
                created_at: new Date().toISOString()
            },
            {
                id: 'agent-002',
                name: 'Data Analyst',
                model: 'mistral',
                status: 'idle',
                capabilities: ['data-analysis', 'visualization', 'reporting'],
                created_at: new Date().toISOString()
            },
            {
                id: 'agent-003',
                name: 'Conversation Agent',
                model: 'llama3.2',
                status: 'idle',
                capabilities: ['chat', 'qa', 'general-purpose'],
                created_at: new Date().toISOString()
            }
        ]
    }
};

export default CONFIG;
