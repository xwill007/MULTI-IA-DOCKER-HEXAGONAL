import APIClient from './api-client.js';

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
            lastUpdate: null
        };
        
        this.subscribers = [];
        this.apiClient = new APIClient();
        
        // Setup API client listeners
        this.setupAPIListeners();
        
        console.log('[StateManager] Initialized');
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
        console.log('[StateManager] Loading agents...');
        
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
            
            console.log('[StateManager] Agents loaded successfully');
            return agents;
        } catch (error) {
            console.error('[StateManager] Failed to load agents:', error);
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
        console.log('[StateManager] Creating agent:', agentData);
        
        this.updateState({ loading: true, error: null });
        
        try {
            const newAgent = await this.apiClient.createAgent(agentData);
            
            // Agregar a la lista local
            const updatedAgents = [...this.state.agents, newAgent];
            
            this.updateState({
                agents: updatedAgents,
                loading: false
            });
            
            console.log('[StateManager] Agent created successfully');
            return newAgent;
        } catch (error) {
            console.error('[StateManager] Failed to create agent:', error);
            this.updateState({
                error: error.message,
                loading: false
            });
            throw error;
        }
    }
    
    /**
     * Enviar query
     */
    async sendQuery(query) {
        console.log('[StateManager] Sending query:', query);
        
        this.updateState({ loading: true, error: null });
        
        try {
            const result = await this.apiClient.sendQuery(query);
            
            this.updateState({ loading: false });
            
            console.log('[StateManager] Query sent successfully');
            return result;
        } catch (error) {
            console.error('[StateManager] Failed to send query:', error);
            this.updateState({
                error: error.message,
                loading: false
            });
            throw error;
        }
    }
    
    /**
     * Seleccionar agente
     */
    selectAgent(agentId) {
        const agent = this.state.agents.find(a => a.id === agentId);
        
        if (agent) {
            this.updateState({ selectedAgent: agent });
            console.log('[StateManager] Agent selected:', agent);
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
                console.error('[StateManager] Error in subscriber:', error);
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
