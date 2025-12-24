import CONFIG from '../config.js';
import { calculateOrbitPosition } from '../utils/helpers.js';
import { createLogger } from '../utils/logs.js';
import { getAgentPromptInfo } from '../utils/agent-prompts.js';

// Per-file logging control (undefined = use global)
const ShowLogs = undefined;
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
        
        this.el.emit('agent-selected', {
            agentId: this.data.agentId,
            agentName: this.data.agentName,
            model: this.data.model,
            status: this.data.status
        });

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
        // Eliminar panel previo
        const existing = this.el.querySelector('.agent-config-panel');
        if (existing) existing.parentNode.removeChild(existing);

        const panel = document.createElement('a-entity');
        panel.setAttribute('class', 'agent-config-panel');
        panel.setAttribute('position', '0 -1.6 0');

        const bg = document.createElement('a-plane');
        bg.setAttribute('width', 2.2);
        bg.setAttribute('height', 1.4);
        bg.setAttribute('color', '#121212');
        bg.setAttribute('opacity', 0.9);
        panel.appendChild(bg);

        const title = document.createElement('a-text');
        title.setAttribute('value', 'Configurar agente');
        title.setAttribute('align', 'center');
        title.setAttribute('position', '0 0.55 0.01');
        title.setAttribute('color', '#FFFFFF');
        title.setAttribute('width', 2.0);
        panel.appendChild(title);

        // Mostrar parámetros actuales
        const info = getAgentPromptInfo(this.data.model);
        const conf = (window.vrApp?.stateManager?.state?.agents || []).find(a => a.id === this.data.agentId)?.config || {};
        const current = {
            prompt: conf.prompt || info.prompt,
            temperature: (conf.options && conf.options.temperature) || info.temperature || 0.7,
            num_predict: (conf.options && conf.options.num_predict) || info.num_predict || 150
        };
        const text = document.createElement('a-text');
        text.setAttribute('value', `temp: ${current.temperature}\nnum_predict: ${current.num_predict}`);
        text.setAttribute('align', 'left');
        text.setAttribute('position', '-1 0.25 0.01');
        text.setAttribute('color', '#CCCCCC');
        text.setAttribute('width', 2.0);
        panel.appendChild(text);

        const promptLabel = document.createElement('a-text');
        promptLabel.setAttribute('value', `Prompt: ${(current.prompt || '').slice(0, 140)}...`);
        promptLabel.setAttribute('align', 'left');
        promptLabel.setAttribute('position', '-1 -0.05 0.01');
        promptLabel.setAttribute('color', '#CCCCCC');
        promptLabel.setAttribute('width', 2.0);
        panel.appendChild(promptLabel);

        // Guardar referencia al componente al inicio
        const component = this;

        // Botón editar
        const editBtn = document.createElement('a-entity');
        const editBg = document.createElement('a-plane');
        editBg.setAttribute('width', 0.8);
        editBg.setAttribute('height', 0.25);
        editBg.setAttribute('color', '#FF9800');
        editBg.setAttribute('class', 'clickable interactive');
        editBtn.appendChild(editBg);
        const editText = document.createElement('a-text');
        editText.setAttribute('value', 'EDITAR');
        editText.setAttribute('align', 'center');
        editText.setAttribute('position', '0 0 0.01');
        editText.setAttribute('color', '#000');
        editText.setAttribute('width', 0.7);
        editBtn.appendChild(editText);
        editBtn.setAttribute('position', '-0.8 -0.5 0.02');
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
        toggleBg.setAttribute('class', 'clickable interactive');
        toggleBtn.appendChild(toggleBg);
        const toggleText = document.createElement('a-text');
        toggleText.setAttribute('value', toggleLabel);
        toggleText.setAttribute('align', 'center');
        toggleText.setAttribute('position', '0 0 0.01');
        toggleText.setAttribute('color', '#FFF');
        toggleText.setAttribute('width', 0.7);
        toggleBtn.appendChild(toggleText);
        toggleBtn.setAttribute('position', '0 -0.5 0.02');
        panel.appendChild(toggleBtn);

        // Botón cerrar
        const closeBtn = document.createElement('a-entity');
        const closeBg = document.createElement('a-plane');
        closeBg.setAttribute('width', 0.8);
        closeBg.setAttribute('height', 0.25);
        closeBg.setAttribute('color', '#9E9E9E');
        closeBg.setAttribute('class', 'clickable interactive');
        closeBtn.appendChild(closeBg);
        const closeText = document.createElement('a-text');
        closeText.setAttribute('value', 'CERRAR');
        closeText.setAttribute('align', 'center');
        closeText.setAttribute('position', '0 0 0.01');
        closeText.setAttribute('color', '#000');
        closeText.setAttribute('width', 0.7);
        closeBtn.appendChild(closeText);
        closeBtn.setAttribute('position', '0.8 -0.5 0.02');
        
        // Event listener para CERRAR button - en el closeBg (el a-plane)
        closeBg.addEventListener('click', (evt) => {
            log('Close button clicked via closeBg');
            evt.stopPropagation();
            // Remover el panel directamente
            const panelToRemove = component.el.querySelector('.agent-config-panel');
            if (panelToRemove) {
                component.el.removeChild(panelToRemove);
                log('Panel removed successfully');
            }
        });
        
        panel.appendChild(closeBtn);

        // Eventos - agregar listeners de editar y toggle
        editBtn.addEventListener('click', async () => {
            try {
                const nt = parseFloat(prompt('Nueva temperatura (0-1):', String(current.temperature)) || String(current.temperature));
                const np = parseInt(prompt('Nuevo num_predict:', String(current.num_predict)) || String(current.num_predict), 10);
                const pr = prompt('Nuevo prompt:', current.prompt) || current.prompt;
                const config = { prompt: pr, options: { temperature: nt, num_predict: np } };
                const sm = window.vrApp && window.vrApp.stateManager;
                if (sm) {
                    await sm.updateAgentConfig(component.data.agentId, config);
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
                    text.setAttribute('value', `temp: ${nt}\nnum_predict: ${np}`);
                    promptLabel.setAttribute('value', `Prompt: ${(pr || '').slice(0, 140)}...`);
                }
            } catch (e) {
                console.error('Failed updating config', e);
            }
        });

        // Guardar referencia al panel
        component.configPanel = panel;

        // Toggle status event
        toggleBtn.addEventListener('click', async () => {
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

        this.el.appendChild(panel);
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
