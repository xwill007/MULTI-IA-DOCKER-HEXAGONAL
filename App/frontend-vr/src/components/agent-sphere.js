import CONFIG from '../config.js';
import { calculateOrbitPosition } from '../utils/helpers.js';

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
        sphere.setAttribute('color', modelColor);
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
        console.log('Agent clicked:', this.data.agentId);
        
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
    },
    
    onHover: function() {
        this.sphere.setAttribute('scale', '1.2 1.2 1.2');
        this.label.setAttribute('scale', '1.8 1.8 1.8');
    },
    
    onLeave: function() {
        this.sphere.setAttribute('scale', '1 1 1');
        this.label.setAttribute('scale', '1.5 1.5 1.5');
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
