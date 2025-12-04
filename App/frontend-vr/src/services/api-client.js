import CONFIG from '../config.js';

/**
 * Cliente HTTP para comunicación con la API del orchestrator
 */
class APIClient {
    constructor() {
        this.baseURL = CONFIG.API_BASE_URL;
        this.timeout = CONFIG.API_TIMEOUT;
        this.retryAttempts = CONFIG.RETRY_ATTEMPTS || 3;
        this.retryDelay = CONFIG.RETRY_DELAY || 2000;
        this.connected = false;
        this.listeners = new Map();
        
        console.log('[APIClient] Initialized', {
            baseURL: this.baseURL,
            mockMode: CONFIG.MOCK_MODE
        });
    }
    
    /**
     * Verificar conexión con el servidor
     */
    async checkConnection() {
        if (CONFIG.MOCK_MODE) {
            console.log('[APIClient] Mock mode enabled, simulating connection');
            this.connected = true;
            this.emit('connectionChange', true);
            return true;
        }
        
        try {
            const response = await this.fetchWithTimeout(`${this.baseURL}/health`, {
                method: 'GET'
            });
            
            this.connected = response.ok;
            this.emit('connectionChange', this.connected);
            return this.connected;
        } catch (error) {
            console.error('[APIClient] Connection check failed:', error);
            this.connected = false;
            this.emit('connectionChange', false);
            return false;
        }
    }
    
    /**
     * Obtener lista de agentes
     */
    async getAgents() {
        console.log('[APIClient] Getting agents...');
        
        if (CONFIG.MOCK_MODE) {
            await this.simulateDelay(500);
            const agents = CONFIG.MOCK_DATA.agents;
            console.log('[APIClient] Returning mock agents:', agents);
            this.emit('agentsUpdate', agents);
            return agents;
        }
        
        try {
            const response = await this.fetchWithRetry(`${this.baseURL}/agents`);
            const data = await response.json();
            
            console.log('[APIClient] Agents received:', data);
            this.emit('agentsUpdate', data.agents || data);
            return data.agents || data;
        } catch (error) {
            console.error('[APIClient] Failed to get agents:', error);
            this.emit('error', error.message);
            throw error;
        }
    }
    
    /**
     * Crear un nuevo agente
     */
    async createAgent(agentData) {
        console.log('[APIClient] Creating agent:', agentData);
        
        if (CONFIG.MOCK_MODE) {
            await this.simulateDelay(1000);
            const newAgent = {
                id: `agent-${Date.now()}`,
                ...agentData,
                status: 'idle',
                created_at: new Date().toISOString()
            };
            console.log('[APIClient] Mock agent created:', newAgent);
            return newAgent;
        }
        
        try {
            const response = await this.fetchWithRetry(`${this.baseURL}/agents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(agentData)
            });
            
            const data = await response.json();
            console.log('[APIClient] Agent created:', data);
            return data;
        } catch (error) {
            console.error('[APIClient] Failed to create agent:', error);
            this.emit('error', error.message);
            throw error;
        }
    }
    
    /**
     * Enviar query al orchestrator
     */
    async sendQuery(query) {
        console.log('[APIClient] Sending query:', query);
        
        if (CONFIG.MOCK_MODE) {
            await this.simulateDelay(1500);
            
            // Generate relevant mock response
            let response = '';
            const lowerQuery = query.toLowerCase();
            
            if (lowerQuery.includes('como te llamas') || lowerQuery.includes('tu nombre') || lowerQuery.includes('who are you')) {
                response = 'Soy el Orquestador Multi-IA, un sistema de coordinación de agentes inteligentes. Trabajo con agentes especializados (Code Analyzer, Data Analyst, Conversation Agent) para procesar tus solicitudes de manera eficiente.';
            } else if (lowerQuery.includes('code quality') || lowerQuery.includes('calidad')) {
                response = 'El análisis de calidad de código incluye: estructura del proyecto, adherencia a mejores prácticas, métricas de complejidad, y detección de code smells. Los agentes especializados pueden revisar múltiples lenguajes.';
            } else if (lowerQuery.includes('documentation') || lowerQuery.includes('documentación')) {
                response = 'Puedo generar documentación automática incluyendo: diagramas de arquitectura, comentarios de API, guías de uso, y especificaciones técnicas. Los agentes analizan el código fuente para extraer información relevante.';
            } else if (lowerQuery.includes('security') || lowerQuery.includes('seguridad')) {
                response = 'El análisis de seguridad cubre: inyección SQL, XSS, CSRF, gestión insegura de credenciales, dependencias vulnerables, y configuraciones incorrectas. Se utilizan múltiples agentes especializados.';
            } else {
                response = `He procesado tu consulta: "${query}". En modo producción, coordinaré múltiples agentes IA especializados para analizar y responder de manera integral. Actualmente en modo MOCK para desarrollo.`;
            }
            
            const result = {
                query: query,
                response: response,
                timestamp: new Date().toISOString(),
                agents_used: ['Code Analyzer', 'Data Analyst', 'Conversation Agent'],
                mode: 'mock'
            };
            console.log('[APIClient] Mock query result:', result);
            return result;
        }
        
        try {
            const response = await this.fetchWithRetry(`${this.baseURL}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query })
            });
            
            const data = await response.json();
            console.log('[APIClient] Query response:', data);
            // Return full result with all agent responses
            return {
                orchestrator_response: data.orchestrator_response,
                agents_responses: data.agents_responses || [],
                final_response: data.final_response || data.response,
                reasoning: data.reasoning,
                processing_time: data.processing_time,
                response: data.final_response || data.response // backward compatibility
            };
        } catch (error) {
            console.error('[APIClient] Failed to send query:', error);
            this.emit('error', error.message);
            throw error;
        }
    }
    
    /**
     * Fetch con timeout
     */
    async fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }
    
    /**
     * Fetch con retry logic
     */
    async fetchWithRetry(url, options = {}, attempt = 1) {
        try {
            const response = await this.fetchWithTimeout(url, options);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response;
        } catch (error) {
            if (attempt < this.retryAttempts) {
                console.log(`[APIClient] Retry attempt ${attempt}/${this.retryAttempts}`);
                const backoff = this.retryDelay * attempt;
                await this.simulateDelay(backoff);
                return this.fetchWithRetry(url, options, attempt + 1);
            }
            throw error;
        }
    }
    
    /**
     * Simular delay (para mock mode)
     */
    simulateDelay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Event emitter - on
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    /**
     * Event emitter - off
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }
    
    /**
     * Event emitter - emit
     */
    emit(event, data) {
        if (!this.listeners.has(event)) return;
        
        this.listeners.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`[APIClient] Error in ${event} listener:`, error);
            }
        });
    }
}

export default APIClient;
