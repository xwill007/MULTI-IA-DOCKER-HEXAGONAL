import CONFIG from '../config.js';

/**
 * Componente Orchestrator Hub - El cerebro central del sistema
 */
AFRAME.registerComponent('orchestrator-hub', {
    schema: {
        radius: { type: 'number', default: CONFIG.ORCHESTRATOR.radius },
        color: { type: 'string', default: CONFIG.ORCHESTRATOR.color },
        pulseSpeed: { type: 'number', default: CONFIG.ORCHESTRATOR.pulseSpeed }
    },
    
    init: function() {
        const el = this.el;
        const data = this.data;
        
        // Crear esfera principal
        const sphere = document.createElement('a-sphere');
        sphere.setAttribute('radius', data.radius);
        sphere.setAttribute('color', data.color);
        sphere.setAttribute('metalness', 0.8);
        sphere.setAttribute('roughness', 0.2);
        sphere.setAttribute('segments-height', 32);
        sphere.setAttribute('segments-width', 32);
        el.appendChild(sphere);
        
        // Animación de rotación
        sphere.setAttribute('animation__rotate', {
            property: 'rotation',
            to: '0 360 0',
            loop: true,
            dur: 20000,
            easing: 'linear'
        });
        
        // Animación de pulso
        sphere.setAttribute('animation__pulse', {
            property: 'scale',
            from: '1 1 1',
            to: '1.1 1.1 1.1',
            dir: 'alternate',
            loop: true,
            dur: data.pulseSpeed,
            easing: 'easeInOutSine'
        });
        
        // Anillo orbital (en lugar de partículas para evitar errores)
        const ring = document.createElement('a-torus');
        ring.setAttribute('radius', data.radius + 0.5);
        ring.setAttribute('radius-tubular', 0.05);
        ring.setAttribute('color', data.color);
        ring.setAttribute('opacity', 0.5);
        ring.setAttribute('animation__spin', {
            property: 'rotation',
            to: '0 360 0',
            loop: true,
            dur: 10000,
            easing: 'linear'
        });
        el.appendChild(ring);
        
        // Texto del título
        const title = document.createElement('a-text');
        title.setAttribute('value', 'ORCHESTRATOR');
        title.setAttribute('align', 'center');
        title.setAttribute('position', `0 ${data.radius + 1} 0`);
        title.setAttribute('scale', '2 2 2');
        title.setAttribute('color', data.color);
        title.setAttribute('font', 'roboto');
        el.appendChild(title);
        
        this.sphere = sphere;
        this.ring = ring;
        this.title = title;
    },
    
    /**
     * Cambiar estado del orchestrator
     */
    setState: function(state) {
        const stateColors = {
            idle: CONFIG.ORCHESTRATOR.color,
            processing: '#FF9800',
            error: '#F44336',
            disconnected: '#9E9E9E'
        };
        
        const color = stateColors[state] || CONFIG.ORCHESTRATOR.color;
        
        if (this.sphere) {
            this.sphere.setAttribute('animation__colorchange', {
                property: 'color',
                to: color,
                dur: 500,
                easing: 'easeInOutQuad'
            });
        }
        
        if (this.particles) {
            this.particles.setAttribute('particle-system', 'color', color);
        }
    },
    
    /**
     * Animar pulso (cuando procesa query)
     */
    pulse: function() {
        if (this.sphere) {
            this.sphere.setAttribute('animation__bigpulse', {
                property: 'scale',
                from: '1 1 1',
                to: '1.3 1.3 1.3',
                dur: 500,
                dir: 'alternate',
                loop: 3,
                easing: 'easeInOutQuad'
            });
        }
    }
});

export default 'orchestrator-hub';
