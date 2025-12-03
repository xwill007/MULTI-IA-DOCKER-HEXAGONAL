import CONFIG from '../config.js';

/**
 * Componente Status Message - Muestra mensajes de estado en VR
 */
AFRAME.registerComponent('status-message', {
    schema: {
        message: { type: 'string', default: '' },
        type: { type: 'string', default: 'info' },
        duration: { type: 'number', default: 3000 }
    },
    
    init: function() {
        const el = this.el;
        const data = this.data;
        
        const typeColors = {
            info: '#2196F3',
            success: '#4CAF50',
            warning: '#FF9800',
            error: '#F44336'
        };
        
        const color = typeColors[data.type] || typeColors.info;
        
        const panel = document.createElement('a-plane');
        panel.setAttribute('width', 3);
        panel.setAttribute('height', 0.8);
        panel.setAttribute('color', color);
        panel.setAttribute('opacity', 0.9);
        panel.setAttribute('shader', 'flat');
        el.appendChild(panel);
        
        const text = document.createElement('a-text');
        text.setAttribute('value', data.message);
        text.setAttribute('align', 'center');
        text.setAttribute('width', 2.8);
        text.setAttribute('position', '0 0 0.01');
        text.setAttribute('color', '#FFFFFF');
        text.setAttribute('wrap-count', 40);
        el.appendChild(text);
        
        const icon = this.createIcon(data.type);
        icon.setAttribute('position', '-1.3 0 0.01');
        el.appendChild(icon);
        
        el.setAttribute('scale', '0 0 0');
        el.setAttribute('animation__appear', {
            property: 'scale',
            to: '1 1 1',
            dur: 300,
            easing: 'easeOutBack'
        });
        
        if (data.duration > 0) {
            setTimeout(() => this.dismiss(), data.duration);
        }
        
        this.panel = panel;
        this.text = text;
    },
    
    createIcon: function(type) {
        const iconText = {
            info: 'i',
            success: 'OK',
            warning: '!',
            error: 'X'
        };
        
        const icon = document.createElement('a-text');
        icon.setAttribute('value', iconText[type] || iconText.info);
        icon.setAttribute('align', 'center');
        icon.setAttribute('scale', '2 2 2');
        icon.setAttribute('color', '#FFFFFF');
        
        return icon;
    },
    
    updateMessage: function(message, type) {
        this.text.setAttribute('value', message);
        
        const typeColors = {
            info: '#2196F3',
            success: '#4CAF50',
            warning: '#FF9800',
            error: '#F44336'
        };
        
        const color = typeColors[type] || typeColors.info;
        this.panel.setAttribute('color', color);
    },
    
    dismiss: function() {
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

/**
 * Sistema para gestionar múltiples mensajes
 */
AFRAME.registerSystem('status-messages', {
    init: function() {
        this.messageQueue = [];
        this.activeMessages = [];
        this.maxMessages = 3;
        this.yOffset = 2;
        this.ySpacing = 1;
        this.container = null;
    },
    
    showMessage: function(message, type = 'info', duration = 3000) {
        if (!this.container) {
            this.container = document.createElement('a-entity');
            this.container.setAttribute('id', 'messages-container');
            this.container.setAttribute('position', '0 3 -2');
            this.el.sceneEl.appendChild(this.container);
        }
        
        if (this.activeMessages.length >= this.maxMessages) {
            const oldest = this.activeMessages.shift();
            if (oldest && oldest.parentNode) {
                oldest.components['status-message'].dismiss();
            }
        }
        
        const messageEl = document.createElement('a-entity');
        messageEl.setAttribute('status-message', {
            message: message,
            type: type,
            duration: duration
        });
        
        const yPos = this.activeMessages.length * this.ySpacing;
        messageEl.setAttribute('position', `0 ${-yPos} 0`);
        
        this.container.appendChild(messageEl);
        this.activeMessages.push(messageEl);
        
        setTimeout(() => {
            const index = this.activeMessages.indexOf(messageEl);
            if (index > -1) {
                this.activeMessages.splice(index, 1);
                this.repositionMessages();
            }
        }, duration + 300);
    },
    
    repositionMessages: function() {
        this.activeMessages.forEach((msg, index) => {
            const yPos = index * this.ySpacing;
            msg.setAttribute('animation__reposition', {
                property: 'position',
                to: `0 ${-yPos} 0`,
                dur: 300,
                easing: 'easeInOutQuad'
            });
        });
    },
    
    clearAll: function() {
        this.activeMessages.forEach(msg => {
            if (msg.components['status-message']) {
                msg.components['status-message'].dismiss();
            }
        });
        this.activeMessages = [];
    }
});

export default 'status-message';
