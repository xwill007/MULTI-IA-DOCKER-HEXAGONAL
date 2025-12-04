import CONFIG from '../config.js';

/**
 * Componente Query Panel - Panel interactivo para enviar queries
 */
AFRAME.registerComponent('query-panel', {
    schema: {
        width: { type: 'number', default: 2 },
        height: { type: 'number', default: 1.25 },
        visible: { type: 'boolean', default: true }
    },
    
    init: function() {
        const el = this.el;
        const data = this.data;
        
        const mainPanel = document.createElement('a-plane');
        mainPanel.setAttribute('width', data.width);
        mainPanel.setAttribute('height', data.height);
        mainPanel.setAttribute('color', '#1E1E1E');
        mainPanel.setAttribute('opacity', 0.95);
        mainPanel.setAttribute('shader', 'flat');
        el.appendChild(mainPanel);
        
        const title = document.createElement('a-text');
        title.setAttribute('value', 'QUERY ORCHESTRATOR');
        title.setAttribute('align', 'center');
        title.setAttribute('width', data.width - 0.4);
        title.setAttribute('position', `0 ${data.height/2 - 0.3} 0.01`);
        title.setAttribute('color', CONFIG.ORCHESTRATOR.color);
        title.setAttribute('font', 'roboto');
        title.setAttribute('wrap-count', 40);
        el.appendChild(title);
        
        const inputLabel = document.createElement('a-text');
        inputLabel.setAttribute('value', 'Query:');
        inputLabel.setAttribute('align', 'left');
        inputLabel.setAttribute('position', `${-data.width/2 + 0.2} 0.6 0.01`);
        inputLabel.setAttribute('color', '#FFFFFF');
        inputLabel.setAttribute('width', data.width - 0.4);
        el.appendChild(inputLabel);
        
        const inputBg = document.createElement('a-plane');
        inputBg.setAttribute('width', data.width - 0.4);
        inputBg.setAttribute('height', 0.6);
        inputBg.setAttribute('position', '0 0.2 0.01');
        inputBg.setAttribute('color', '#2A2A2A');
        inputBg.setAttribute('class', 'clickable interactive');
        el.appendChild(inputBg);
        
        const inputText = document.createElement('a-text');
        inputText.setAttribute('value', 'Click to enter query...');
        inputText.setAttribute('align', 'center');
        inputText.setAttribute('position', '0 0.2 0.02');
        inputText.setAttribute('color', '#888888');
        inputText.setAttribute('width', data.width - 0.6);
        inputText.setAttribute('wrap-count', 50);
        el.appendChild(inputText);
        
        const predefinedQueries = [
            'Cuéntame un chiste'
        ];
        
        const queryButtons = [];
        predefinedQueries.forEach((query, index) => {
            const button = this.createButton(
                query,
                { x: 0, y: -0.4 - (index * 0.35), z: 0.01 },
                () => this.sendQuery(query)
            );
            el.appendChild(button);
            queryButtons.push(button);
        });
        
        const sendButton = this.createButton(
            'SEND CUSTOM QUERY',
            { x: 0, y: -data.height/2 + 2.0, z: 0.01 },
            () => this.sendCustomQuery(),
            CONFIG.ORCHESTRATOR.color
        );
        el.appendChild(sendButton);
        
        const statusText = document.createElement('a-text');
        statusText.setAttribute('value', '');
        statusText.setAttribute('align', 'center');
        statusText.setAttribute('position', `0 ${-data.height/2 + 0.1} 0.01`);
        statusText.setAttribute('color', '#888888');
        statusText.setAttribute('width', data.width - 0.4);
        statusText.setAttribute('wrap-count', 50);
        el.appendChild(statusText);
        
        this.inputText = inputText;
        this.inputBg = inputBg;
        this.statusText = statusText;
        this.currentQuery = '';
        this.queryButtons = queryButtons;
        
        inputBg.addEventListener('click', this.onInputClick.bind(this));
        
        if (!data.visible) {
            el.setAttribute('visible', false);
        }
    },
    
    createButton: function(label, position, onClick, color = '#21f33d') {
        const button = document.createElement('a-entity');
        
        const bg = document.createElement('a-plane');
        bg.setAttribute('width', 3.5);
        bg.setAttribute('height', 0.3);
        bg.setAttribute('color', color);
        bg.setAttribute('opacity', 0.8);
        bg.setAttribute('class', 'clickable interactive');
        button.appendChild(bg);
        
        const text = document.createElement('a-text');
        text.setAttribute('value', label);
        text.setAttribute('align', 'center');
        text.setAttribute('position', '0 0 0.01');
        text.setAttribute('color', '#FFFFFF');
        text.setAttribute('width', 3.3);
        button.appendChild(text);
        
        button.setAttribute('position', `${position.x} ${position.y} ${position.z}`);
        
        button.addEventListener('mouseenter', () => {
            bg.setAttribute('scale', '1.05 1.05 1');
            bg.setAttribute('opacity', 1);
        });
        
        button.addEventListener('mouseleave', () => {
            bg.setAttribute('scale', '1 1 1');
            bg.setAttribute('opacity', 0.8);
        });
        
        button.addEventListener('click', () => {
            bg.setAttribute('animation__click', {
                property: 'scale',
                from: '1 1 1',
                to: '0.95 0.95 1',
                dur: 100,
                dir: 'alternate',
                loop: 1
            });
            
            setTimeout(onClick, 100);
        });
        
        return button;
    },
    
    onInputClick: function() {
        if (!AFRAME.utils.device.checkHeadsetConnected()) {
            const query = prompt('Enter your query:');
            if (query) {
                this.currentQuery = query;
                this.inputText.setAttribute('value', query);
                this.inputText.setAttribute('color', '#FFFFFF');
            }
        } else {
            this.el.sceneEl.systems['status-messages'].showMessage(
                'VR keyboard not implemented. Use predefined queries.',
                'info',
                3000
            );
        }
    },
    
    sendQuery: function(query) {
        this.updateStatus('Sending query...', '#2196F3');
        
        this.el.emit('query-submitted', { query: query });
        
        setTimeout(() => {
            this.updateStatus('Query sent successfully', '#4CAF50');
            setTimeout(() => {
                this.updateStatus('', '#888888');
            }, 2000);
        }, 500);
    },
    
    sendCustomQuery: function() {
        if (!this.currentQuery || this.currentQuery.trim() === '') {
            this.updateStatus('Please enter a query first', '#FF9800');
            return;
        }
        
        this.sendQuery(this.currentQuery);
        
        setTimeout(() => {
            this.currentQuery = '';
            this.inputText.setAttribute('value', 'Click to enter query...');
            this.inputText.setAttribute('color', '#888888');
        }, 1000);
    },
    
    updateStatus: function(message, color) {
        this.statusText.setAttribute('value', message);
        this.statusText.setAttribute('color', color);
    },
    
    toggle: function() {
        const isVisible = this.el.getAttribute('visible');
        this.el.setAttribute('visible', !isVisible);
    }
});

export default 'query-panel';
