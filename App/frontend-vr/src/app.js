import './components/orchestrator-hub.js';
import './components/agent-sphere.js';
import './components/status-message.js';
import './components/query-panel.js';
import './components/agent-creator.js';
import CONFIG from './config.js';
import { showNotification } from './utils/helpers.js';
import StateManager from './services/state-manager.js';

/**
 * Aplicación principal VR
 */
class VRApp {
    constructor() {
        this.stateManager = new StateManager();
        this.scene = null;
        this.orchestratorHub = null;
        this.agentsContainer = null;
        this.queryPanel = null;
        this.agentCreator = null;
        this.agentElements = new Map();
        this.initialized = false;
    }
    
    /**
     * Inicializar aplicación
     */
    async init() {
        console.log('[VRApp] Initializing...');
        
        // Esperar a que el scene esté listo
        await this.waitForScene();
        
        console.log('[VRApp] Scene ready');
        
        // Referencias a elementos
        this.scene = document.querySelector('a-scene');
        this.orchestratorHub = document.querySelector('#orchestrator');
        this.agentsContainer = document.querySelector('#agents-container');
        this.queryPanel = document.querySelector('#query-panel');
        this.agentCreator = document.querySelector('#agent-creator');
        this.loadingScreen = document.querySelector('#loading-screen');
        this.connectionStatus = document.querySelector('#connection-status');
        
        console.log('[VRApp] Elements found:', {
            scene: !!this.scene,
            orchestrator: !!this.orchestratorHub,
            agentsContainer: !!this.agentsContainer
        });
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Subscribe to state changes
        this.stateManager.subscribe((state) => this.onStateChange(state));
        
        // Initial load
        await this.initialLoad();
        
        this.initialized = true;
        console.log('[VRApp] Initialized successfully');
    }
    
    /**
     * Esperar a que el scene esté listo
     */
    waitForScene() {
        return new Promise((resolve) => {
            const scene = document.querySelector('a-scene');
            if (scene && scene.hasLoaded) {
                resolve();
            } else if (scene) {
                scene.addEventListener('loaded', () => resolve(), { once: true });
            } else {
                // Si no hay scene, esperar un poco y resolver
                setTimeout(resolve, 1000);
            }
        });
    }
    
    /**
     * Carga inicial
     */
    async initialLoad() {
        console.log('[VRApp] Initial load starting...');
        
        // Mostrar loading screen
        this.showLoading(true);
        
        try {
            // Intentar cargar agentes
            await this.stateManager.loadAgents();
            
            console.log('[VRApp] Agents loaded successfully');
            
            // Si llegamos aquí, la conexión fue exitosa
            this.updateConnectionStatus(true);
            
        } catch (error) {
            console.error('[VRApp] Initial load failed:', error);
            this.updateConnectionStatus(false);
            
            // Mostrar notificación
            if (CONFIG.MOCK_MODE) {
                this.showSimpleNotification('Running in MOCK MODE', 'info');
            } else {
                this.showSimpleNotification('Failed to connect to API', 'error');
            }
        } finally {
            // Ocultar loading screen
            setTimeout(() => {
                console.log('[VRApp] Hiding loading screen');
                this.showLoading(false);
            }, 500);
        }
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Query panel events
        if (this.queryPanel) {
            this.queryPanel.addEventListener('query-submitted', (e) => {
                this.handleQuerySubmit(e.detail.query);
            });
        }
        
        // Agent creator events
        if (this.agentCreator) {
            this.agentCreator.addEventListener('agent-create-requested', (e) => {
                this.handleAgentCreate(e.detail);
            });
        }
        
        // Agent selection events
        if (this.scene) {
            this.scene.addEventListener('agent-selected', (e) => {
                this.handleAgentSelect(e.detail);
            });
        }
        
        // Keyboard shortcuts (desktop only)
        window.addEventListener('keydown', (e) => {
            this.handleKeyPress(e);
        });
        
        // VR mode change
        if (this.scene) {
            this.scene.addEventListener('enter-vr', () => {
                console.log('[VRApp] Entered VR mode');
                this.showSimpleNotification('VR Mode Active', 'success');
            });
            
            this.scene.addEventListener('exit-vr', () => {
                console.log('[VRApp] Exited VR mode');
            });
        }
    }
    
    /**
     * Cambios en el state
     */
    onStateChange(state) {
        console.log('[VRApp] State changed:', state);
        
        // Update connection status
        this.updateConnectionStatus(state.connected);
        
        // Update agents visualization
        if (state.agents) {
            this.updateAgentsVisualization(state.agents);
        }
        
        // Update orchestrator hub status
        if (this.orchestratorHub && this.orchestratorHub.components['orchestrator-hub']) {
            const hubComponent = this.orchestratorHub.components['orchestrator-hub'];
            if (!state.connected) {
                hubComponent.setState('disconnected');
            } else if (state.loading) {
                hubComponent.setState('processing');
            } else {
                hubComponent.setState('idle');
            }
        }
        
        // Show errors
        if (state.error) {
            this.showSimpleNotification(state.error, 'error');
        }
    }
    
    /**
     * Actualizar visualización de agentes
     */
    updateAgentsVisualization(agents) {
        if (!this.agentsContainer) {
            console.warn('[VRApp] Agents container not found');
            return;
        }
        
        console.log(`[VRApp] Updating ${agents.length} agents`);
        
        const currentAgentIds = new Set(agents.map(a => a.id));
        
        // Remover agentes que ya no existen
        this.agentElements.forEach((element, agentId) => {
            if (!currentAgentIds.has(agentId)) {
                const component = element.components['agent-sphere'];
                if (component && component.remove) {
                    component.remove();
                } else {
                    element.parentNode.removeChild(element);
                }
                this.agentElements.delete(agentId);
            }
        });
        
        // Agregar o actualizar agentes
        agents.forEach((agent, index) => {
            let agentElement = this.agentElements.get(agent.id);
            
            if (!agentElement) {
                // Crear nuevo agente
                agentElement = document.createElement('a-entity');
                agentElement.setAttribute('agent-sphere', {
                    agentId: agent.id,
                    agentName: agent.name,
                    model: agent.model,
                    status: agent.status || 'idle',
                    orbitIndex: index,
                    orbitTotal: agents.length
                });
                
                this.agentsContainer.appendChild(agentElement);
                this.agentElements.set(agent.id, agentElement);
                
                console.log(`[VRApp] Created agent: ${agent.name}`);
                
            } else {
                // Actualizar agente existente
                const component = agentElement.components['agent-sphere'];
                if (component && component.updateStatus) {
                    component.updateStatus(agent.status || 'idle');
                }
                // Actualizar orbit parameters
                agentElement.setAttribute('agent-sphere', {
                    orbitIndex: index,
                    orbitTotal: agents.length
                });
            }
        });
    }
    
    /**
     * Handle query submit
     */
    async handleQuerySubmit(query) {
        console.log('[VRApp] Query submitted:', query);
        
        // Pulse orchestrator
        if (this.orchestratorHub && this.orchestratorHub.components['orchestrator-hub']) {
            const component = this.orchestratorHub.components['orchestrator-hub'];
            if (component.pulse) {
                component.pulse();
            }
        }
        
        // Send query through state manager
        try {
            const result = await this.stateManager.sendQuery(query);
            this.showSimpleNotification('Query sent successfully', 'success');
            console.log('[VRApp] Query result:', result);
        } catch (error) {
            this.showSimpleNotification('Failed to send query', 'error');
            console.error('[VRApp] Query error:', error);
        }
    }
    
    /**
     * Handle agent creation
     */
    async handleAgentCreate(agentData) {
        console.log('[VRApp] Creating agent:', agentData);
        
        try {
            const newAgent = await this.stateManager.createAgent(agentData);
            this.showSimpleNotification(`Agent "${agentData.name}" created`, 'success');
            console.log('[VRApp] Agent created:', newAgent);
        } catch (error) {
            this.showSimpleNotification('Failed to create agent', 'error');
            console.error('[VRApp] Create agent error:', error);
        }
    }
    
    /**
     * Handle agent selection
     */
    handleAgentSelect(agentInfo) {
        console.log('[VRApp] Agent selected:', agentInfo);
        this.stateManager.selectAgent(agentInfo.agentId);
        
        this.showSimpleNotification(
            `Selected: ${agentInfo.agentName} (${agentInfo.model})`,
            'info'
        );
    }
    
    /**
     * Handle keyboard shortcuts
     */
    handleKeyPress(event) {
        // Q - Toggle query panel
        if (event.key === 'q' || event.key === 'Q') {
            if (this.queryPanel && this.queryPanel.components['query-panel']) {
                this.queryPanel.components['query-panel'].toggle();
            }
        }
        
        // C - Toggle agent creator
        if (event.key === 'c' || event.key === 'C') {
            if (this.agentCreator && this.agentCreator.components['agent-creator']) {
                this.agentCreator.components['agent-creator'].toggle();
            }
        }
        
        // R - Reload agents
        if (event.key === 'r' || event.key === 'R') {
            this.stateManager.loadAgents();
            this.showSimpleNotification('Reloading agents...', 'info');
        }
        
        // M - Toggle mock mode
        if (event.key === 'm' || event.key === 'M') {
            CONFIG.MOCK_MODE = !CONFIG.MOCK_MODE;
            this.showSimpleNotification(
                `Mock mode: ${CONFIG.MOCK_MODE ? 'ON' : 'OFF'}`,
                'info'
            );
            this.stateManager.loadAgents();
        }
    }
    
    /**
     * Update connection status indicator
     */
    updateConnectionStatus(connected) {
        if (!this.connectionStatus) return;
        
        const statusText = this.connectionStatus.querySelector('#status-text');
        
        if (connected) {
            this.connectionStatus.className = 'connected';
            if (statusText) {
                statusText.textContent = CONFIG.MOCK_MODE ? 'Mock Mode' : 'Connected';
            }
        } else {
            this.connectionStatus.className = 'disconnected';
            if (statusText) {
                statusText.textContent = 'Disconnected';
            }
        }
    }
    
    /**
     * Show/hide loading screen
     */
    showLoading(show) {
        if (!this.loadingScreen) return;
        
        if (show) {
            this.loadingScreen.style.display = 'flex';
            this.loadingScreen.classList.remove('hidden');
        } else {
            this.loadingScreen.classList.add('hidden');
            setTimeout(() => {
                this.loadingScreen.style.display = 'none';
            }, 500);
        }
    }
    
    /**
     * Show simple notification
     */
    showSimpleNotification(message, type) {
        console.log(`[VRApp] Notification [${type}]: ${message}`);
        // Intentar usar el sistema de notificaciones VR si está disponible
        if (this.scene && this.scene.systems['status-messages']) {
            this.scene.systems['status-messages'].showMessage(message, type, 3000);
        }
    }
}

// Initialize app when DOM is ready
console.log('[VRApp] Script loaded, waiting for DOM...');

function initApp() {
    console.log('[VRApp] DOM ready, creating app instance...');
    const app = new VRApp();
    app.init().catch(error => {
        console.error('[VRApp] Failed to initialize:', error);
    });
    
    // Make app globally accessible for debugging
    window.vrApp = app;
    console.log('[VRApp] App instance created and available as window.vrApp');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

export default VRApp;
