import CONFIG from '../config.js';
import { calculateOrbitPosition } from '../utils/helpers.js';
import { createLogger } from '../utils/logs.js';
import { getAgentPromptInfo } from '../utils/agent-prompts.js';

// Per-file logging control (undefined = use global)
const ShowLogs = true;
const log = createLogger('[Agent Sphere]', ShowLogs);

/**
 * Componente Agent Sphere - Representa un agente IA
 */
AFRAME.registerComponent('agent-sphere', {
    schema: {
        agentId: { type: 'string', default: '' },
        agentName: { type: 'string', default: 'Agent' },
        model: { type: 'string', default: 'llama3.2' },
        status: { type: 'string', default: 'idle' },
        orbitIndex: { type: 'number', default: 0 },
        orbitTotal: { type: 'number', default: 1 },
        orbitRadius: { type: 'number', default: CONFIG.AGENTS.orbitRadius },
        orbitSpeed: { type: 'number', default: CONFIG.AGENTS.orbitSpeed }
    },
    
    init: function() {
        const el = this.el;
        const data = this.data;
        
        // Color basado en el modelo
        const modelColor = CONFIG.AGENTS.colors[data.model] || CONFIG.AGENTS.colors.default;
        
        // Crear esfera del agente
        const sphere = document.createElement('a-sphere');
        sphere.setAttribute('radius', CONFIG.AGENTS.sphereRadius);
        sphere.setAttribute('metalness', 0.6);
        sphere.setAttribute('roughness', 0.3);
        sphere.setAttribute('class', 'clickable interactive');
        el.appendChild(sphere);
        
        // Anillo de status
        const statusRing = document.createElement('a-ring');
        statusRing.setAttribute('radius-inner', CONFIG.AGENTS.sphereRadius + 0.1);
        statusRing.setAttribute('radius-outer', CONFIG.AGENTS.sphereRadius + 0.15);
        statusRing.setAttribute('rotation', '90 0 0');
        statusRing.setAttribute('position', '0 0 0');
        this.updateStatusRing(statusRing, data.status);
        el.appendChild(statusRing);
        
        // Texto con nombre del agente
        const label = document.createElement('a-text');
        label.setAttribute('value', data.agentName);
        label.setAttribute('align', 'center');
        label.setAttribute('position', `0 ${CONFIG.AGENTS.sphereRadius + 0.5} 0`);
        label.setAttribute('scale', '1.5 1.5 1.5');
        label.setAttribute('color', '#FFFFFF');
        el.appendChild(label);
        
        // Texto con modelo
        const modelLabel = document.createElement('a-text');
        modelLabel.setAttribute('value', data.model);
        modelLabel.setAttribute('align', 'center');
        modelLabel.setAttribute('position', `0 ${CONFIG.AGENTS.sphereRadius + 0.3} 0`);
        modelLabel.setAttribute('scale', '1 1 1');
        modelLabel.setAttribute('color', modelColor);
        modelLabel.setAttribute('opacity', 0.8);
        el.appendChild(modelLabel);

        // Panel de respuesta del agente (doble cara)
        const responsePanel = document.createElement('a-entity');
        
        // Texto (visible por ambos lados) - sin fondo para mejor visualización
        const responseText = document.createElement('a-text');
        responseText.setAttribute('value', '');
        responseText.setAttribute('align', 'center');
        responseText.setAttribute('position', '0 -1.0 0.01');
        responseText.setAttribute('color', '#FFFFFF');
        responseText.setAttribute('width', 2.0);
        responseText.setAttribute('wrap-count', 36);
        responseText.setAttribute('side', 'double');
        responsePanel.appendChild(responseText);

        el.appendChild(responsePanel);
        
        // Calcular ángulo inicial de órbita
        this.angle = (data.orbitIndex / data.orbitTotal) * Math.PI * 2;
        this.time = 0;
        
        // Guardar referencias
        this.sphere = sphere;
        this.statusRing = statusRing;
        this.label = label;
        this.modelLabel = modelLabel;
        this.modelColor = modelColor;
        this.responsePanel = responsePanel;
        this.responseText = responseText;

        // Aplicar opacity si el agente está inactivo
        if (data.status === 'inactive') {
            sphere.setAttribute('opacity', 0.2);
            label.setAttribute('opacity', 0.3);
            modelLabel.setAttribute('opacity', 0.3);
            statusRing.setAttribute('opacity', 0.2);
        }

        // Generar textura con prompt y parámetros sobre la esfera
        try {
            const info = getAgentPromptInfo(data.model);
            const canvas = this.createPromptCanvas({
                name: data.agentName,
                model: data.model,
                prompt: info.prompt,
                temperature: info.temperature,
                num_predict: info.num_predict,
                color: modelColor
            });
            // Usar canvas como textura
            this.sphere.setAttribute('material', {
                src: canvas,
                shader: 'standard'
            });
        } catch (e) {
            // Fallback al color si algo falla
            this.sphere.setAttribute('color', modelColor);
        }
        
        // Event handlers
        el.addEventListener('click', this.onClick.bind(this));
        el.addEventListener('mouseenter', this.onHover.bind(this));
        el.addEventListener('mouseleave', this.onLeave.bind(this));
        
        // Animación de entrada
        el.setAttribute('scale', '0 0 0');
        el.setAttribute('animation__appear', {
            property: 'scale',
            to: '1 1 1',
            dur: 500,
            easing: 'easeOutBack'
        });
    },

    // Crear canvas con texto envuelto y fondo estilizado
    createPromptCanvas: function({ name, model, prompt, temperature, num_predict, color }) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Fondo degradado
        const grad = ctx.createLinearGradient(0, 0, 512, 512);
        grad.addColorStop(0, '#000000');
        grad.addColorStop(1, '#1f1f1f');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Banda superior con color del modelo
        ctx.fillStyle = color || '#4a90e2';
        ctx.fillRect(0, 0, canvas.width, 64);

        // Títulos
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px Arial';
        ctx.fillText(`${name}`, 16, 36);
        ctx.font = '16px Arial';
        ctx.fillText(`Modelo: ${model}`, 16, 58);

        // Parámetros
        ctx.font = 'bold 18px Arial';
        ctx.fillText('Parámetros', 16, 92);
        ctx.font = '16px Arial';
        ctx.fillText(`temperature: ${temperature}`, 16, 116);
        ctx.fillText(`num_predict: ${num_predict}`, 16, 138);

        // Prompt
        ctx.font = 'bold 18px Arial';
        ctx.fillText('Prompt', 16, 168);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#e0e0e0';
        this.wrapText(ctx, prompt || 'Sin prompt disponible', 16, 192, 480, 22, 8);

        return canvas;
    },

    // Utilidad para envolver texto en canvas
    wrapText: function(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
        if (!text) return;
        const words = text.split(' ');
        let line = '';
        let lineCount = 0;
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line.trim(), x, y);
                line = words[n] + ' ';
                y += lineHeight;
                lineCount++;
                if (maxLines && lineCount >= maxLines) {
                    ctx.fillText('…', x, y);
                    return;
                }
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line.trim(), x, y);
    },
    
    tick: function(time, deltaTime) {
        const data = this.data;
        
        // Orbitar alrededor del orchestrator
        this.time += (deltaTime * 0.001) * data.orbitSpeed;
        
        const position = calculateOrbitPosition(
            this.angle + this.time,
            data.orbitRadius,
           6 + Math.sin(this.time * 2) * 0.3
        );
        
        // Posición relativa al orchestrator
        const orchestratorPos = CONFIG.ORCHESTRATOR.position;
        this.el.setAttribute('position', {
            x: orchestratorPos.x + position.x,
            y: orchestratorPos.y + (position.y - 3),
            z: orchestratorPos.z + position.z
        });
        
        // Rotación suave (lenta para facilitar lectura)
        this.el.object3D.rotation.y = this.time * 0.15;
    },
    
    updateStatusRing: function(ring, status) {
        const color = CONFIG.AGENTS.statusColors[status] || CONFIG.AGENTS.statusColors.idle;
        ring.setAttribute('color', color);
        
        if (status === 'processing') {
            ring.setAttribute('animation__pulse', {
                property: 'scale',
                from: '1 1 1',
                to: '1.2 1.2 1.2',
                dir: 'alternate',
                loop: true,
                dur: 1000,
                easing: 'easeInOutSine'
            });
        } else {
            ring.removeAttribute('animation__pulse');
            ring.setAttribute('scale', '1 1 1');
        }
    },
    
    updateStatus: function(newStatus) {
        this.data.status = newStatus;
        this.updateStatusRing(this.statusRing, newStatus);
        
        if (newStatus === 'processing') {
            this.sphere.setAttribute('animation__glow', {
                property: 'components.material.material.emissiveIntensity',
                from: 0,
                to: 0.5,
                dir: 'alternate',
                loop: true,
                dur: 500
            });
        } else {
            this.sphere.removeAttribute('animation__glow');
        }
    },

    // Actualizar texto de respuesta en la esfera
    updateResponse: function(text, responseTime) {
        if (!this.responseText) return;
        const content = (text || '').trim();
        const shown = content.length > 0 ? content.slice(0, 140) : '';
        const timeInfo = responseTime ? `\n[${responseTime}s]` : '';
        const fullText = shown + timeInfo;
        
        // Actualizar texto (visible por ambos lados con side=double)
        this.responseText.setAttribute('value', fullText);
        
        // Actualizar label con tiempo si existe
        if (responseTime && this.label) {
            const currentName = this.data.agentName;
            this.label.setAttribute('value', `${currentName} (${responseTime}s)`);
        }
    },
    
    onClick: function() {
        log('Agent clicked:', this.data.agentId);
        
        // Verificar si el panel ya existe
        const existing = this.el.querySelector('.agent-config-panel');
        if (existing) {
            // Si existe, cerrarlo (remover)
            log('Closing existing config panel');
            this.el.removeChild(existing);
            return;
        }
        
        this.el.setAttribute('animation__click', {
            property: 'scale',
            from: '1 1 1',
            to: '1.2 1.2 1.2',
            dur: 200,
            dir: 'alternate',
            loop: 1,
            easing: 'easeInOutQuad'
        });
        
        // COMENTADO: Este evento causaba refresh de todos los agentes
        // this.el.emit('agent-selected', {
        //     agentId: this.data.agentId,
        //     agentName: this.data.agentName,
        //     model: this.data.model,
        //     status: this.data.status
        // });

        // Mostrar panel de configuración junto a la esfera
        this.showConfigPanel();
    },
    
    onHover: function() {
        this.sphere.setAttribute('scale', '1.2 1.2 1.2');
        this.label.setAttribute('scale', '1.8 1.8 1.8');
    },
    
    onLeave: function() {
        this.sphere.setAttribute('scale', '1 1 1');
        this.label.setAttribute('scale', '1.5 1.5 1.5');
    },

    showConfigPanel: function() {
        log('showConfigPanel called');
        
        // Eliminar panel previo
        const existing = this.el.querySelector('.agent-config-panel');
        if (existing) {
            log('Removing existing panel');
            existing.parentNode.removeChild(existing);
        }

        log('Creating new config panel');
        const panel = document.createElement('a-entity');
        panel.setAttribute('class', 'agent-config-panel');
        panel.setAttribute('position', '1.5 0 0');
        panel.setAttribute('rotation', '0 0 0');

        const bg = document.createElement('a-plane');
        bg.setAttribute('width', 3.0);  // Más ancho para más campos
        bg.setAttribute('height', 2.5);  // Más alto
        bg.setAttribute('color', '#121212');
        bg.setAttribute('opacity', 0.9);
        bg.setAttribute('material', 'side: double');
        panel.appendChild(bg);

        const title = document.createElement('a-text');
        title.setAttribute('value', 'Configurar agente');
        title.setAttribute('align', 'center');
        title.setAttribute('position', '0 1.15 0.01');
        title.setAttribute('color', '#FFFFFF');
        title.setAttribute('width', 2.8);
        title.setAttribute('side', 'double');
        panel.appendChild(title);

        // Obtener datos actuales del agente
        const info = getAgentPromptInfo(this.data.model);
        const agentData = (window.vrApp?.stateManager?.state?.agents || []).find(a => a.id === this.data.agentId) || {};
        const conf = agentData.config || {};
        const current = {
            prompt: conf.prompt || info.prompt,
            temperature: (conf.options && conf.options.temperature) || info.temperature || 0.7,
            num_predict: (conf.options && conf.options.num_predict) || info.num_predict || 150,
            internet_access: agentData.internet_access || false,
            allowed_domains: agentData.allowed_domains || [],
            target_urls: agentData.target_urls || [],
            search_terms: agentData.search_terms || []
        };

        // Sección: Parámetros LLM
        const llmSection = document.createElement('a-text');
        llmSection.setAttribute('value', '=== LLM Config ===');
        llmSection.setAttribute('align', 'center');
        llmSection.setAttribute('position', '0 0.85 0.01');
        llmSection.setAttribute('color', '#FFD700');
        llmSection.setAttribute('width', 2.5);
        llmSection.setAttribute('side', 'double');
        panel.appendChild(llmSection);

        const text = document.createElement('a-text');
        text.setAttribute('value', `temp: ${current.temperature} | num_predict: ${current.num_predict}`);
        text.setAttribute('align', 'center');
        text.setAttribute('position', '0 0.65 0.01');
        text.setAttribute('color', '#CCCCCC');
        text.setAttribute('width', 2.8);
        text.setAttribute('side', 'double');
        panel.appendChild(text);

        const promptLabel = document.createElement('a-text');
        promptLabel.setAttribute('value', `Prompt: ${(current.prompt || '').slice(0, 80)}...`);
        promptLabel.setAttribute('align', 'left');
        promptLabel.setAttribute('position', '-1.4 0.4 0.01');
        promptLabel.setAttribute('color', '#CCCCCC');
        promptLabel.setAttribute('width', 2.8);
        promptLabel.setAttribute('side', 'double');
        panel.appendChild(promptLabel);

        // Sección: Web Connector
        const webSection = document.createElement('a-text');
        webSection.setAttribute('value', '=== Web Connector ===');
        webSection.setAttribute('align', 'center');
        webSection.setAttribute('position', '0 0.1 0.01');
        webSection.setAttribute('color', '#4CAF50');
        webSection.setAttribute('width', 2.5);
        webSection.setAttribute('side', 'double');
        panel.appendChild(webSection);

        const internetStatus = document.createElement('a-text');
        internetStatus.setAttribute('value', `Internet: ${current.internet_access ? 'ON' : 'OFF'}`);
        internetStatus.setAttribute('align', 'center');
        internetStatus.setAttribute('position', '0 -0.1 0.01');
        internetStatus.setAttribute('color', current.internet_access ? '#4CAF50' : '#F44336');
        internetStatus.setAttribute('width', 2.5);
        internetStatus.setAttribute('side', 'double');
        panel.appendChild(internetStatus);

        const domainsInfo = document.createElement('a-text');
        domainsInfo.setAttribute('value', `Domains: ${current.allowed_domains.length}`);
        domainsInfo.setAttribute('align', 'left');
        domainsInfo.setAttribute('position', '-1.4 -0.3 0.01');
        domainsInfo.setAttribute('color', '#AAAAAA');
        domainsInfo.setAttribute('width', 2.8);
        domainsInfo.setAttribute('side', 'double');
        panel.appendChild(domainsInfo);

        const urlsInfo = document.createElement('a-text');
        urlsInfo.setAttribute('value', `URLs: ${current.target_urls.length}`);
        urlsInfo.setAttribute('align', 'left');
        urlsInfo.setAttribute('position', '-1.4 -0.5 0.01');
        urlsInfo.setAttribute('color', '#AAAAAA');
        urlsInfo.setAttribute('width', 2.8);
        urlsInfo.setAttribute('side', 'double');
        panel.appendChild(urlsInfo);

        const termsInfo = document.createElement('a-text');
        termsInfo.setAttribute('value', `Search terms: ${current.search_terms.length}`);
        termsInfo.setAttribute('align', 'left');
        termsInfo.setAttribute('position', '-1.4 -0.7 0.01');
        termsInfo.setAttribute('color', '#AAAAAA');
        termsInfo.setAttribute('width', 2.8);
        termsInfo.setAttribute('side', 'double');
        panel.appendChild(termsInfo);

        // Guardar referencia al componente al inicio
        const component = this;

        // Botón editar
        const editBtn = document.createElement('a-entity');
        const editBg = document.createElement('a-plane');
        editBg.setAttribute('width', 0.8);
        editBg.setAttribute('height', 0.25);
        editBg.setAttribute('color', '#FF9800');
        editBg.setAttribute('material', 'side: double');
        editBg.setAttribute('class', 'clickable interactive');
        editBtn.appendChild(editBg);
        const editText = document.createElement('a-text');
        editText.setAttribute('value', 'EDITAR');
        editText.setAttribute('align', 'center');
        editText.setAttribute('position', '0 0 0.01');
        editText.setAttribute('color', '#000');
        editText.setAttribute('width', 0.7);
        editText.setAttribute('side', 'double');
        editBtn.appendChild(editText);
        editBtn.setAttribute('position', '-1 -0.95 0.02');
        panel.appendChild(editBtn);

        // Botón activar/desactivar
        const toggleBtn = document.createElement('a-entity');
        const toggleBg = document.createElement('a-plane');
        const currentStatus = (window.vrApp?.stateManager?.state?.agents || []).find(a => a.id === this.data.agentId)?.status || this.data.status || 'active';
        const toggleColor = currentStatus === 'active' ? '#F44336' : '#4CAF50';
        const toggleLabel = currentStatus === 'active' ? 'DESACTIVAR' : 'ACTIVAR';
        toggleBg.setAttribute('width', 0.8);
        toggleBg.setAttribute('height', 0.25);
        toggleBg.setAttribute('color', toggleColor);
        toggleBg.setAttribute('material', 'side: double');
        toggleBg.setAttribute('class', 'clickable interactive');
        toggleBtn.appendChild(toggleBg);
        const toggleText = document.createElement('a-text');
        toggleText.setAttribute('value', toggleLabel);
        toggleText.setAttribute('align', 'center');
        toggleText.setAttribute('position', '0 0 0.01');
        toggleText.setAttribute('color', '#FFF');
        toggleText.setAttribute('width', 0.7);
        toggleText.setAttribute('side', 'double');
        toggleBtn.appendChild(toggleText);
        toggleBtn.setAttribute('position', '1 -0.95 0.02');
        panel.appendChild(toggleBtn);

        // Botón cerrar (X en esquina superior derecha)
        const closeBtn = document.createElement('a-entity');
        const closeBg = document.createElement('a-plane');
        closeBg.setAttribute('width', 0.3);
        closeBg.setAttribute('height', 0.3);
        closeBg.setAttribute('color', '#F44336');
        closeBg.setAttribute('material', 'side: double');
        closeBg.setAttribute('class', 'clickable interactive');
        closeBtn.appendChild(closeBg);
        const closeText = document.createElement('a-text');
        closeText.setAttribute('value', 'X');
        closeText.setAttribute('align', 'center');
        closeText.setAttribute('position', '0 0 0.01');
        closeText.setAttribute('color', '#FFF');
        closeText.setAttribute('width', 0.8);
        closeText.setAttribute('side', 'double');
        closeBtn.appendChild(closeText);
        closeBtn.setAttribute('position', '1.55 0.85 0.02');  // Esquina superior derecha
        
        // Event listener para CERRAR button
        closeBg.addEventListener('click', (evt) => {
            log('Close button clicked via closeBg');
            evt.stopPropagation();
            const panelToRemove = component.el.querySelector('.agent-config-panel');
            if (panelToRemove) {
                component.el.removeChild(panelToRemove);
                log('Panel removed successfully');
            }
        });
        
        panel.appendChild(closeBtn);

        // Event listener para EDITAR LLM y Web Connector
        editBg.addEventListener('click', async (evt) => {
            log('Edit button clicked');
            evt.stopPropagation();
            try {
                // Obtener datos actuales del agente completo
                const currentAgent = (window.vrApp?.stateManager?.state?.agents || []).find(a => a.id === component.data.agentId);
                
                // Prompts para parámetros LLM
                const nt = parseFloat(prompt('Nueva temperatura (0-1):', String(current.temperature)) || String(current.temperature));
                const np = parseInt(prompt('Nuevo num_predict:', String(current.num_predict)) || String(current.num_predict), 10);
                const pr = prompt('Nuevo prompt:', current.prompt) || current.prompt;
                
                // Prompts para Web Connector
                const allowedDomains = (prompt('Dominios permitidos (separados por coma):', (currentAgent?.allowed_domains || []).join(', ')) || '').split(',').map(d => d.trim()).filter(d => d);
                const targetUrls = (prompt('URLs objetivo (separadas por coma):', (currentAgent?.target_urls || []).join(', ')) || '').split(',').map(u => u.trim()).filter(u => u);
                const searchTerms = (prompt('Términos de búsqueda (separados por coma):', (currentAgent?.search_terms || []).join(', ')) || '').split(',').map(t => t.trim()).filter(t => t);
                
                // Pregunta de internet access al final con texto ON/OFF o TRUE/FALSE
                const currentInternetStatus = currentAgent?.internet_access ? 'ON' : 'OFF';
                const internetInput = (prompt(`Acceso a internet (ON/OFF o TRUE/FALSE):`, currentInternetStatus) || currentInternetStatus).toUpperCase();
                const internetAccess = internetInput === 'ON' || internetInput === 'TRUE';
                
                // Construir payload completo
                const updatePayload = {
                    name: component.data.agentName,
                    config: { prompt: pr, options: { temperature: nt, num_predict: np } },
                    internet_access: internetAccess,
                    allowed_domains: allowedDomains,
                    target_urls: targetUrls,
                    search_terms: searchTerms
                };
                
                const sm = window.vrApp && window.vrApp.stateManager;
                if (sm) {
                    // Actualizar via API
                    const apiClient = sm.apiClient;
                    if (apiClient) {
                        const response = await fetch(`${apiClient.baseURL}/agents/${component.data.agentId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updatePayload)
                        });
                        
                        if (response.ok) {
                            const updatedAgent = await response.json();
                            log('Agent updated successfully:', updatedAgent);
                            
                            // Actualizar estado local
                            const agents = sm.state.agents.map(a => {
                                if (a.id === component.data.agentId) {
                                    return updatedAgent;
                                }
                                return a;
                            });
                            sm.updateState({ agents });
                            
                            // Regenerar textura
                            const canvas = component.createPromptCanvas({
                                name: component.data.agentName,
                                model: component.data.model,
                                prompt: pr,
                                temperature: nt,
                                num_predict: np,
                                color: component.modelColor
                            });
                            component.sphere.setAttribute('material', { src: canvas, shader: 'standard' });
                            
                            // Actualizar displays
                            text.setAttribute('value', `temp: ${nt}\nnum_predict: ${np}`);
                            promptLabel.setAttribute('value', `Prompt: ${(pr || '').slice(0, 140)}...`);
                            internetText.setAttribute('value', internetAccess ? 'Internet: ON' : 'Internet: OFF');
                            domainsText.setAttribute('value', `Domains: ${allowedDomains.length}`);
                            urlsText.setAttribute('value', `URLs: ${targetUrls.length}`);
                            termsText.setAttribute('value', `Search terms: ${searchTerms.length}`);
                        }
                    }
                }
            } catch (e) {
                console.error('Failed updating agent', e);
            }
        });

        // Guardar referencia al panel
        component.configPanel = panel;

        // Toggle status event - listener en toggleBg
        toggleBg.addEventListener('click', async (evt) => {
            log('Toggle button clicked');
            evt.stopPropagation();
            try {
                const sm = window.vrApp && window.vrApp.stateManager;
                if (sm) {
                    // DELETE endpoint togglea el status
                    const apiClient = sm.apiClient;
                    if (apiClient) {
                        const response = await fetch(`${apiClient.baseURL}/agents/${component.data.agentId}`, {
                            method: 'DELETE'
                        });
                        if (response.ok) {
                            const result = await response.json();
                            const newStatus = result.new_status;
                            
                            // Actualizar estado local
                            const agents = sm.state.agents.map(a => {
                                if (a.id === component.data.agentId) {
                                    return { ...a, status: newStatus };
                                }
                                return a;
                            });
                            sm.updateState({ agents });
                            
                            // Actualizar visual del panel
                            const newColor = newStatus === 'active' ? '#F44336' : '#4CAF50';
                            const newLabel = newStatus === 'active' ? 'DESACTIVAR' : 'ACTIVAR';
                            toggleBg.setAttribute('color', newColor);
                            toggleText.setAttribute('value', newLabel);
                            
                            // Actualizar esfera
                            if (newStatus === 'inactive') {
                                component.sphere.setAttribute('opacity', 0.2);
                                component.label.setAttribute('opacity', 0.3);
                                component.modelLabel.setAttribute('opacity', 0.3);
                                component.statusRing.setAttribute('opacity', 0.2);
                            } else {
                                component.sphere.setAttribute('opacity', 1);
                                component.label.setAttribute('opacity', 1);
                                component.modelLabel.setAttribute('opacity', 0.8);
                                component.statusRing.setAttribute('opacity', 1);
                            }
                            
                            log('Status toggled to', newStatus);
                        }
                    }
                }
            } catch (e) {
                console.error('[Agent Sphere] Failed toggling status', e);
            }
        });

        log('Appending panel to agent sphere element');
        this.el.appendChild(panel);
        log('Panel appended successfully, childCount:', this.el.children.length);
    },
    
    remove: function() {
        this.el.setAttribute('animation__disappear', {
            property: 'scale',
            to: '0 0 0',
            dur: 300,
            easing: 'easeInBack'
        });
        
        setTimeout(() => {
            if (this.el.parentNode) {
                this.el.parentNode.removeChild(this.el);
            }
        }, 300);
    }
});

export default 'agent-sphere';
