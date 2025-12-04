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
        sphere.setAttribute('opacity', 0.5);
        sphere.setAttribute('metalness', 0.8);
        sphere.setAttribute('roughness', 0.2);
        sphere.setAttribute('segments-height', 32);
        sphere.setAttribute('segments-width', 32);
        el.appendChild(sphere);
        
        // Animación de rotación (lenta para facilitar lectura)
        sphere.setAttribute('animation__rotate', {
            property: 'rotation',
            to: '0 360 0',
            loop: true,
            dur: 60000,
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
        ring.setAttribute('opacity', 0.3);
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
        title.setAttribute('color', '#FFFFFF');
        title.setAttribute('font', 'roboto');
        el.appendChild(title);
        
        this.sphere = sphere;
        this.ring = ring;
        this.title = title;

        // Texto de respuesta central (debajo de la esfera como los agentes) - sin fondo
        const responseText = document.createElement('a-text');
        responseText.setAttribute('value', '');
        responseText.setAttribute('align', 'center');
        responseText.setAttribute('position', `0 ${-data.radius - 1.8} 0.01`);
        responseText.setAttribute('width', 10);
        responseText.setAttribute('color', '#FFFFFF');
        responseText.setAttribute('wrap-count', 120);
        responseText.setAttribute('side', 'double');
        el.appendChild(responseText);

        this.responseText = responseText;
        
        // Timer text para mostrar tiempo transcurrido
        const timerText = document.createElement('a-text');
        timerText.setAttribute('value', '');
        timerText.setAttribute('align', 'center');
        timerText.setAttribute('position', `0 ${-data.radius - 0.8} 0.02`);
        timerText.setAttribute('width', 6);
        timerText.setAttribute('color', '#FFD700');
        timerText.setAttribute('font', 'roboto');
        el.appendChild(timerText);
        
        this.timerText = timerText;
        this.timerInterval = null;
        this.startTime = null;
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
    ,
    /**
     * Actualiza la respuesta mostrada en el hub
     */
    updateResponse: function(text) {
        if (!this.responseText) return;
        const content = (text || '').trim();
        const shown = content.length > 0 ? content.slice(0, 220) : '';
        this.responseText.setAttribute('value', shown);
    },
    
    /**
     * Inicia el contador de tiempo
     */
    startTimer: function() {
        if (!this.timerText) return;
        
        this.startTime = Date.now();
        this.timerText.setAttribute('value', 'Tiempo: 0s');
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            this.timerText.setAttribute('value', `Tiempo: ${elapsed}s`);
            
            // Cambiar color según tiempo transcurrido
            if (elapsed > 120) {
                this.timerText.setAttribute('color', '#F44336'); // Rojo después de 2 min
            } else if (elapsed > 60) {
                this.timerText.setAttribute('color', '#FF9800'); // Naranja después de 1 min
            } else {
                this.timerText.setAttribute('color', '#FFD700'); // Amarillo inicial
            }
        }, 1000);
    },
    
    /**
     * Detiene el contador de tiempo
     */
    stopTimer: function() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        if (this.timerText && this.startTime) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            this.timerText.setAttribute('value', `Completado en ${elapsed}s`);
            this.timerText.setAttribute('color', '#4CAF50'); // Verde al completar
            
            // Limpiar después de 5 segundos
            setTimeout(() => {
                if (this.timerText) {
                    this.timerText.setAttribute('value', '');
                }
            }, 5000);
        }
        
        // Restaurar escala de la esfera a su estado inicial
        if (this.sphere) {
            this.sphere.setAttribute('animation__restore', {
                property: 'scale',
                to: '1 1 1',
                dur: 500,
                easing: 'easeInOutQuad'
            });
        }
    }
});

export default 'orchestrator-hub';
