import CONFIG from '../config.js';

/**
 * Cliente HTTP para comunicación con la API del orchestrator
 */
class APIClient {
    constructor() {
        this.baseURL = CONFIG.API_BASE_URL;
        this.timeout = CONFIG.API_TIMEOUT;
        this.retryAttempts = CONFIG.API_RETRY_ATTEMPTS;
        this.retryDelay = CONFIG.API_RETRY_DELAY;
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
            const result = {
                query: query,
                response: `Mock response for: ${query}`,
                timestamp: new Date().toISOString(),
                agents_used: ['agent-001', 'agent-002']
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
            console.log('[APIClient] Query result:', data);
            return data;
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
                await this.simulateDelay(this.retryDelay);
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
