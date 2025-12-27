import APIClient from './api-client.js';
import { createLogger } from '../utils/logs.js';

// Control de logs para este servicio (undefined = usa global)
const ShowLogs = undefined;
const log = createLogger('[StateManager]', ShowLogs);

/**
 * Gestor de estado global de la aplicación
 */
class StateManager {
    constructor() {
        this.state = {
            connected: false,
            connectionMode: null,
            agents: [],
            selectedAgent: null,
            loading: false,
            error: null,
            lastUpdate: null,
            conversationId: null
        };
        
        this.subscribers = [];
        this.apiClient = new APIClient();
        
        // Setup API client listeners
        this.setupAPIListeners();
        
        log('Initialized');
    }
    
    /**
     * Setup listeners del API client
     */
    setupAPIListeners() {
        this.apiClient.on('connectionChange', (connected) => {
            this.updateState({
                connected,
                connectionMode: connected ? 'real' : null
            });
        });
        
        this.apiClient.on('agentsUpdate', (agents) => {
            this.updateState({
                agents,
                lastUpdate: new Date().toISOString()
            });
        });
        
        this.apiClient.on('error', (error) => {
            this.updateState({
                error,
                loading: false
            });
        });
    }
    
    /**
     * Cargar agentes
     */
    async loadAgents() {
        log('Loading agents...');
        
        this.updateState({ loading: true, error: null });
        
        try {
            // Verificar conexión primero
            const connected = await this.apiClient.checkConnection();
            
            // Obtener agentes
            const agents = await this.apiClient.getAgents();
            
            this.updateState({
                agents,
                connected,
                connectionMode: connected ? 'real' : 'mock',
                loading: false,
                lastUpdate: new Date().toISOString()
            });
            
            log('Agents loaded successfully');
            return agents;
        } catch (error) {
            log.error('Failed to load agents:', error);
            this.updateState({
                error: error.message,
                loading: false
            });
            throw error;
        }
    }
    
    /**
     * Crear nuevo agente
     */
    async createAgent(agentData) {
        log('Creating agent:', agentData);
        
        this.updateState({ loading: true, error: null });
        
        try {
            const newAgent = await this.apiClient.createAgent(agentData);
            log('Agent created successfully:', newAgent);
            
            // Recargar todos los agentes desde el backend para asegurar consistencia
            // Esto garantiza que el agente esté persistido correctamente
            await this.loadAgents();
            
            return newAgent;
        } catch (error) {
            log.error('Failed to create agent:', error);
            this.updateState({
                error: error.message,
                loading: false
            });
            throw error;
        }
    }

    /**
     * Actualizar configuración del agente y refrescar estado
     */
    async updateAgentConfig(agentId, config) {
        log('Updating agent config:', agentId, config);
        this.updateState({ loading: true, error: null });
        try {
            const updated = await this.apiClient.updateAgentConfig(agentId, config);
            // Merge into local state
            const agents = this.state.agents.map(a => {
                if (a.id === agentId) {
                    return { ...a, config: { ...(a.config || {}), ...(config || {}) } };
                }
                return a;
            });
            this.updateState({ agents, loading: false });
            return updated;
        } catch (error) {
            log.error('Failed to update agent config:', error);
            this.updateState({ error: error.message, loading: false });
            throw error;
        }
    }
    
    /**
     * Enviar query
     */
    async sendQuery(query) {
        log('Sending query:', query);
        
        this.updateState({ loading: true, error: null });
        
        try {
            // Include conversation_id in the request
            const result = await this.apiClient.sendQuery(query, this.state.conversationId);
            
            // Store conversation_id from response
            if (result && result.conversation_id) {
                this.updateState({ 
                    loading: false,
                    conversationId: result.conversation_id
                });
                log('Conversation ID:', result.conversation_id);
            } else {
                this.updateState({ loading: false });
            }
            
            log('Query sent successfully');
            return result;
        } catch (error) {
            log.error('Failed to send query:', error);
            this.updateState({
                error: error.message,
                loading: false
            });
            throw error;
        }
    }

    /**
     * Reiniciar conversación (fuerza nuevo conversation_id en próximo envío)
     */
    resetConversation() {
        log('Resetting conversation context');
        this.updateState({ conversationId: null });
    }
    
    /**
     * Seleccionar agente
     */
    selectAgent(agentId) {
        const agent = this.state.agents.find(a => a.id === agentId);
        
        if (agent) {
            this.updateState({ selectedAgent: agent });
            log('Agent selected:', agent);
        }
    }
    
    /**
     * Actualizar estado
     */
    updateState(updates) {
        this.state = {
            ...this.state,
            ...updates
        };
        
        this.notifySubscribers();
    }
    
    /**
     * Subscribe a cambios de estado
     */
    subscribe(callback) {
        this.subscribers.push(callback);
        
        // Llamar inmediatamente con el estado actual
        callback(this.state);
        
        // Retornar función para unsubscribe
        return () => {
            const index = this.subscribers.indexOf(callback);
            if (index > -1) {
                this.subscribers.splice(index, 1);
            }
        };
    }
    
    /**
     * Notificar a subscribers
     */
    notifySubscribers() {
        this.subscribers.forEach(callback => {
            try {
                callback(this.state);
            } catch (error) {
                log.error('Error in subscriber:', error);
            }
        });
    }
    
    /**
     * Obtener estado actual
     */
    getState() {
        return { ...this.state };
    }
}

export default StateManager;
