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
        
        // Pulse orchestrator and start timer
        if (this.orchestratorHub && this.orchestratorHub.components['orchestrator-hub']) {
            const component = this.orchestratorHub.components['orchestrator-hub'];
            if (component.pulse) {
                component.pulse();
            }
            if (component.startTimer) {
                component.startTimer();
            }
        }
        
        // Show processing message
        this.showSimpleNotification('Processing query...', 'info');
        
        // Send query through state manager
        try {
            const result = await this.stateManager.sendQuery(query);
            
            // Route results to spheres and orchestrator hub
            if (result) {
                // Update orchestrator hub
                const orch = document.querySelector('#orchestrator');
                if (orch && orch.components['orchestrator-hub']) {
                    const finalText = result.final_response || result.orchestrator_response || result.response;
                    orch.components['orchestrator-hub'].updateResponse(finalText);
                }

                // Update each agent sphere with response time
                if (Array.isArray(result.agents_responses)) {
                    result.agents_responses.forEach((ar) => {
                        const all = document.querySelectorAll('[agent-sphere]');
                        all.forEach(el => {
                            const comp = el.components['agent-sphere'];
                            if (comp && (comp.data.agentId === ar.agent_id || comp.data.agentName === ar.agent_name)) {
                                comp.updateResponse(ar.response || ar.error || '', ar.response_time);
                            }
                        });
                    });
                }
                
                // Show summary panel
                this.showQueryResult(query, result);
            } else {
                this.showSimpleNotification('Query processed successfully', 'success');
            }
            
            console.log('[VRApp] Query result:', result);
        } catch (error) {
            this.showSimpleNotification('Failed to send query: ' + error.message, 'error');
            console.error('[VRApp] Query error:', error);
        } finally {
            // Stop timer
            if (this.orchestratorHub && this.orchestratorHub.components['orchestrator-hub']) {
                const component = this.orchestratorHub.components['orchestrator-hub'];
                if (component.stopTimer) {
                    component.stopTimer();
                }
            }
        }
    }
    
    /**
     * Show query result in VR with individual agent responses and synthesis
     */
    showQueryResult(query, result) {
        // Remove previous result if exists
        const oldResult = document.querySelector('#query-result');
        if (oldResult) {
            oldResult.parentNode.removeChild(oldResult);
        }
        
        // Create result panel container
        const resultPanel = document.createElement('a-entity');
        resultPanel.setAttribute('id', 'query-result');
        resultPanel.setAttribute('position', '-4 3 -7');
        
        let yOffset = 0;
        const panelWidth = 3.5;
        const panelSpacing = 0.3;
        
        // Query header
        const queryHeader = this.createResultSection(
            'QUERY',
            query,
            { x: 0, y: yOffset, z: 0 },
            panelWidth,
            '#FFD700'
        );
        resultPanel.appendChild(queryHeader);
        yOffset -= 1.5;
        
        // Orchestrator response
        if (result.orchestrator_response || result.response) {
            const orchResponse = result.orchestrator_response || result.response;
            const orchPanel = this.createResultSection(
                'ORCHESTRATOR',
                orchResponse,
                { x: 0, y: yOffset, z: 0 },
                panelWidth,
                '#FFD700'
            );
            resultPanel.appendChild(orchPanel);
            yOffset -= 2.0;
        }
        
        // Individual agent responses
        if (result.agents_responses && result.agents_responses.length > 0) {
            const agentsTitle = document.createElement('a-text');
            agentsTitle.setAttribute('value', '=== AGENT RESPONSES ===');
            agentsTitle.setAttribute('align', 'center');
            agentsTitle.setAttribute('position', `0 ${yOffset} 0.01`);
            agentsTitle.setAttribute('width', panelWidth);
            agentsTitle.setAttribute('color', '#4A90E2');
            resultPanel.appendChild(agentsTitle);
            yOffset -= 0.5;
            
            result.agents_responses.forEach((agentResp, index) => {
                const agentPanel = this.createResultSection(
                    agentResp.agent_name || `Agent ${index + 1}`,
                    agentResp.response || agentResp.error || 'No response',
                    { x: 0, y: yOffset, z: 0 },
                    panelWidth,
                    agentResp.error ? '#F44336' : CONFIG.AGENTS.colors[agentResp.model] || '#4A90E2'
                );
                resultPanel.appendChild(agentPanel);
                yOffset -= 1.8;
            });
        }
        
        // Final synthesis
        if (result.final_response && result.final_response !== result.orchestrator_response) {
            yOffset -= 0.3;
            const synthesisPanel = this.createResultSection(
                'FINAL SYNTHESIS',
                result.final_response,
                { x: 0, y: yOffset, z: 0 },
                panelWidth,
                '#4CAF50'
            );
            resultPanel.appendChild(synthesisPanel);
            yOffset -= 2.0;
        }
        
        // Reasoning (if available)
        if (result.reasoning) {
            yOffset -= 0.2;
            const reasoningPanel = this.createResultSection(
                'REASONING',
                result.reasoning,
                { x: 0, y: yOffset, z: 0 },
                panelWidth,
                '#9B59B6'
            );
            resultPanel.appendChild(reasoningPanel);
            yOffset -= 1.5;
        }
        
        // Processing time
        if (result.processing_time) {
            const timeText = document.createElement('a-text');
            timeText.setAttribute('value', `Processing time: ${result.processing_time}s`);
            timeText.setAttribute('align', 'center');
            timeText.setAttribute('position', `0 ${yOffset - 0.3} 0.01`);
            timeText.setAttribute('width', panelWidth);
            timeText.setAttribute('color', '#888888');
            resultPanel.appendChild(timeText);
            yOffset -= 0.5;
        }
        
        // Close button
        const closeButton = document.createElement('a-plane');
        closeButton.setAttribute('width', 1.5);
        closeButton.setAttribute('height', 0.3);
        closeButton.setAttribute('position', `0 ${yOffset - 0.3} 0.01`);
        closeButton.setAttribute('color', '#F44336');
        closeButton.setAttribute('class', 'clickable');
        resultPanel.appendChild(closeButton);
        
        const closeText = document.createElement('a-text');
        closeText.setAttribute('value', 'CLOSE');
        closeText.setAttribute('align', 'center');
        closeText.setAttribute('position', `0 ${yOffset - 0.3} 0.02`);
        closeText.setAttribute('color', '#FFFFFF');
        closeText.setAttribute('width', 1.4);
        resultPanel.appendChild(closeText);
        
        // Close on click
        closeButton.addEventListener('click', () => {
            resultPanel.parentNode.removeChild(resultPanel);
        });
        
        // Add to scene
        this.scene.appendChild(resultPanel);
        
        // Success notification
        this.showSimpleNotification('Response received!', 'success');
    }
    
    /**
     * Create a result section with title and content
     */
    createResultSection(title, content, position, width, color) {
        const section = document.createElement('a-entity');
        section.setAttribute('position', `${position.x} ${position.y} ${position.z}`);
        
        // Background
        const bg = document.createElement('a-plane');
        const contentLines = Math.ceil(content.length / 80);
        const height = Math.min(Math.max(contentLines * 0.15 + 0.5, 1.0), 2.5);
        bg.setAttribute('width', width);
        bg.setAttribute('height', height);
        bg.setAttribute('color', '#1A1A1A');
        bg.setAttribute('opacity', 0.9);
        section.appendChild(bg);
        
        // Title
        const titleText = document.createElement('a-text');
        titleText.setAttribute('value', title);
        titleText.setAttribute('align', 'center');
        titleText.setAttribute('position', `0 ${height/2 - 0.2} 0.01`);
        titleText.setAttribute('width', width - 0.2);
        titleText.setAttribute('color', color);
        titleText.setAttribute('font', 'roboto');
        section.appendChild(titleText);
        
        // Content
        const contentText = document.createElement('a-text');
        contentText.setAttribute('value', content);
        contentText.setAttribute('align', 'left');
        contentText.setAttribute('position', `${-width/2 + 0.1} ${height/2 - 0.5} 0.01`);
        contentText.setAttribute('width', width - 0.3);
        contentText.setAttribute('color', '#FFFFFF');
        contentText.setAttribute('wrap-count', Math.floor(width * 20));
        contentText.setAttribute('baseline', 'top');
        section.appendChild(contentText);
        
        return section;
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
