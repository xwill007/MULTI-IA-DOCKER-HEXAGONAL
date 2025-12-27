import CONFIG from '../config.js';
import { createLogger } from '../utils/logs.js';

// Control de logs para este servicio (undefined = usa global)
const ShowLogs = undefined;
const log = createLogger('[APIClient]', ShowLogs);

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
        this.logs = [];  // In-memory log store
        
        log('Initialized', {
            baseURL: this.baseURL,
            mockMode: CONFIG.MOCK_MODE
        });
    }
    
    /**
     * Add log entry to localStorage and in-memory storage
     */
    addLog(message) {
        this.logs.push(message);
        try {
            localStorage.setItem('api_debug_logs', JSON.stringify(this.logs.slice(-50))); // Keep last 50
        } catch (e) {
            // localStorage might be unavailable
        }
    }
    
    /**
     * Verificar conexión con el servidor
     */
    async checkConnection() {
        if (CONFIG.MOCK_MODE) {
            log('Mock mode enabled, simulating connection');
            this.addLog('[APIClient] Mock mode enabled');
            this.connected = true;
            this.emit('connectionChange', true);
            return true;
        }
        
        try {
            const checkLog = `Checking connection to ${this.baseURL}/health`;
            log(checkLog);
            this.addLog('[APIClient] ' + checkLog);
            
            const response = await this.fetchWithTimeout(`${this.baseURL}/health`, {
                method: 'GET'
            });
            
            const resultLog = `Health check response status: ${response.status}`;
            log(resultLog);
            this.addLog('[APIClient] ' + resultLog);
            
            this.connected = response.ok;
            this.emit('connectionChange', this.connected);
            return this.connected;
        } catch (error) {
            const errorLog = `Connection check failed: ${error.message}`;
            log.error(errorLog);
            this.addLog('[APIClient] ERROR: ' + errorLog);
            this.connected = false;
            this.emit('connectionChange', false);
            return false;
        }
    }
    
    /**
     * Obtener lista de agentes
     */
    async getAgents() {
        const logEntry = `[${new Date().toISOString()}] [APIClient] Getting agents from: ${this.baseURL}/agents`;
        log(logEntry);
        this.addLog(logEntry);
        
        if (CONFIG.MOCK_MODE) {
            await this.simulateDelay(500);
            const agents = CONFIG.MOCK_DATA.agents;
            log('Returning mock agents:', agents);
            this.emit('agentsUpdate', agents);
            return agents;
        }
        
        try {
            const response = await this.fetchWithRetry(`${this.baseURL}/agents`);
            const statusLog = `Response status: ${response.status} ${response.statusText}`;
            log(statusLog);
            this.addLog('[APIClient] ' + statusLog);
            
            const headerLog = `Headers: content-type=${response.headers.get('content-type')}, content-length=${response.headers.get('content-length')}, ok=${response.ok}`;
            log(headerLog);
            this.addLog('[APIClient] ' + headerLog);
            
            const text = await response.text();
            const textLog = `Raw response (first 300 chars): ${text.substring(0, 300)}`;
            log(textLog);
            this.addLog('[APIClient] ' + textLog);
            
            const data = JSON.parse(text);
            log('Agents received:', data);
            this.addLog('[APIClient] Agents parsed successfully');
            
            // Backend returns List[Agent] directly as JSON array
            const agents = Array.isArray(data) ? data : (data.agents || data);
            const agentCountLog = `Parsed agents count: ${agents.length || agents}`;
            log(agentCountLog);
            this.addLog('[APIClient] ' + agentCountLog);
            
            this.emit('agentsUpdate', agents);
            return agents;
        } catch (error) {
            const errorLog = `ERROR: ${error.message}, Stack: ${error.stack}`;
            log.error('Failed to get agents:', errorLog);
            this.addLog('[APIClient] FAILED: ' + errorLog);
            this.emit('error', `Failed to load agents: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Crear un nuevo agente
     */
    async createAgent(agentData) {
        const logMsg = `Creating agent: ${JSON.stringify(agentData)}`;
        log(logMsg);
        this.addLog(`[APIClient] ${logMsg}`);
        
        if (CONFIG.MOCK_MODE) {
            this.addLog('[APIClient] MOCK_MODE active - agent will NOT be persisted');
            await this.simulateDelay(1000);
            const newAgent = {
                id: `agent-${Date.now()}`,
                ...agentData,
                status: 'idle',
                created_at: new Date().toISOString()
            };
            log('Mock agent created:', newAgent);
            this.addLog(`[APIClient] Mock agent created: ${newAgent.id}`);
            return newAgent;
        }
        
        try {
            const url = `${this.baseURL}/agents`;
            this.addLog(`[APIClient] POST ${url}`);
            
            const response = await this.fetchWithRetry(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(agentData)
            });
            
            this.addLog(`[APIClient] Response status: ${response.status} ${response.statusText}`);
            
            const data = await response.json();
            log('Agent created:', data);
            this.addLog(`[APIClient] Agent created successfully: ${JSON.stringify(data)}`);
            
            return data;
        } catch (error) {
            const errorMsg = `Failed to create agent: ${error.message}`;
            log.error(errorMsg, error);
            this.addLog(`[APIClient] ERROR: ${errorMsg}`);
            this.emit('error', error.message);
            throw error;
        }
    }

    /**
     * Actualizar configuración del agente
     */
    async updateAgentConfig(agentId, config) {
        log('Updating agent config:', agentId, config);
        
        if (CONFIG.MOCK_MODE) {
            await this.simulateDelay(500);
            return { id: agentId, config };
        }

        try {
            const response = await this.fetchWithRetry(`${this.baseURL}/agents/${agentId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ config })
            });
            const data = await response.json();
            log('Agent updated:', data);
            return data;
        } catch (error) {
            log.error('Failed to update agent:', error);
            this.emit('error', error.message);
            throw error;
        }
    }
    
    /**
     * Enviar query al orchestrator
     */
    async sendQuery(query, conversationId = null) {
        log('Sending query:', query, 'conversationId:', conversationId);
        
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
            log('Mock query result:', result);
            return result;
        }
        
        try {
            const requestBody = { query };
            if (conversationId) {
                requestBody.conversation_id = conversationId;
            }
            
            const response = await this.fetchWithRetry(`${this.baseURL}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            const data = await response.json();
            log('Query response:', data);
            // Return full result with all agent responses and conversation_id
            return {
                orchestrator_response: data.orchestrator_response,
                agents_responses: data.agents_responses || [],
                final_response: data.final_response || data.response,
                reasoning: data.reasoning,
                processing_time: data.processing_time,
                conversation_id: data.conversation_id,
                response: data.final_response || data.response // backward compatibility
            };
        } catch (error) {
            log.error('Failed to send query:', error);
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
     * Obtener todas las conversaciones
     */
    async getConversations() {
        log('Getting conversations from:', `${this.baseURL}/conversations`);
        
        if (CONFIG.MOCK_MODE) {
            await this.simulateDelay(300);
            const mockConversations = {
                total_conversations: 3,
                conversations: {
                    'conv-1': {
                        conversation_id: 'conv-1',
                        messages: [
                            { role: 'user', content: '¿Cómo estás?', timestamp: '2025-12-22T10:00:00' },
                            { role: 'assistant', content: 'Bien, gracias', timestamp: '2025-12-22T10:00:05' }
                        ],
                        created_at: '2025-12-22T10:00:00',
                        updated_at: '2025-12-22T10:00:05'
                    },
                    'conv-2': {
                        conversation_id: 'conv-2',
                        messages: [
                            { role: 'user', content: 'Cuéntame un chiste', timestamp: '2025-12-22T11:00:00' },
                            { role: 'assistant', content: '¿Por qué...', timestamp: '2025-12-22T11:00:05' }
                        ],
                        created_at: '2025-12-22T11:00:00',
                        updated_at: '2025-12-22T11:00:05'
                    },
                    'conv-3': {
                        conversation_id: 'conv-3',
                        messages: [
                            { role: 'user', content: 'Explica Python', timestamp: '2025-12-22T12:00:00' },
                            { role: 'assistant', content: 'Python es...', timestamp: '2025-12-22T12:00:05' }
                        ],
                        created_at: '2025-12-22T12:00:00',
                        updated_at: '2025-12-22T12:00:05'
                    }
                }
            };
            log('Returning mock conversations:', mockConversations);
            return mockConversations;
        }
        
        try {
            const response = await this.fetchWithRetry(`${this.baseURL}/conversations`);
            const data = await response.json();
            log('Conversations retrieved:', data);
            return data;
        } catch (error) {
            log.error('Failed to get conversations:', error);
            this.emit('error', error.message);
            throw error;
        }
    }
    
    /**
     * Obtener conversación específica por ID
     */
    async getConversation(conversationId) {
        log('Getting conversation:', conversationId);
        
        if (CONFIG.MOCK_MODE) {
            await this.simulateDelay(200);
            const mockConv = {
                conversation_id: conversationId,
                messages: [
                    { role: 'user', content: 'Mensaje 1', timestamp: '2025-12-22T10:00:00' },
                    { role: 'assistant', content: 'Respuesta 1', timestamp: '2025-12-22T10:00:05' }
                ],
                created_at: '2025-12-22T10:00:00',
                updated_at: '2025-12-22T10:00:05'
            };
            return mockConv;
        }
        
        try {
            const response = await this.fetchWithRetry(`${this.baseURL}/conversations/${conversationId}`);
            const data = await response.json();
            log('Conversation retrieved:', data);
            return data;
        } catch (error) {
            log.error('Failed to get conversation:', error);
            this.emit('error', error.message);
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
                log(`Retry attempt ${attempt}/${this.retryAttempts}`);
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
                log.error(`Error in ${event} listener:`, error);
            }
        });
    }
}

export default APIClient;
