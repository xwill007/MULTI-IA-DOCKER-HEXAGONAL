import CONFIG from '../config.js';

/**
 * Componente Agent Creator - Panel para crear nuevos agentes
 */
AFRAME.registerComponent('agent-creator', {
    schema: {
        width: { type: 'number', default: 4 },
        height: { type: 'number', default: 3.5 },
        visible: { type: 'boolean', default: false }
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
        title.setAttribute('value', 'CREATE NEW AGENT');
        title.setAttribute('align', 'center');
        title.setAttribute('width', data.width - 0.4);
        title.setAttribute('position', `0 ${data.height/2 - 0.3} 0.01`);
        title.setAttribute('color', '#4CAF50');
        title.setAttribute('font', 'roboto');
        el.appendChild(title);
        
        const modelLabel = document.createElement('a-text');
        modelLabel.setAttribute('value', 'Select Model:');
        modelLabel.setAttribute('align', 'left');
        modelLabel.setAttribute('position', `${-data.width/2 + 0.2} 1.2 0.01`);
        modelLabel.setAttribute('color', '#FFFFFF');
        modelLabel.setAttribute('width', data.width - 0.4);
        el.appendChild(modelLabel);
        
        const models = [
            { name: 'llama3.2', label: 'Llama 3.2', desc: 'General purpose' },
            { name: 'codellama', label: 'CodeLlama', desc: 'Code analysis' },
            { name: 'mistral', label: 'Mistral', desc: 'Data analysis' }
        ];
        
        this.selectedModel = 'llama3.2';
        this.modelButtons = [];
        
        models.forEach((model, index) => {
            const button = this.createModelButton(
                model,
                { x: -1 + (index * 1.3), y: 0.6, z: 0.01 }
            );
            el.appendChild(button);
            this.modelButtons.push({ name: model.name, element: button });
        });
        
        const nameLabel = document.createElement('a-text');
        nameLabel.setAttribute('value', 'Agent Name:');
        nameLabel.setAttribute('align', 'left');
        nameLabel.setAttribute('position', `${-data.width/2 + 0.2} 0.1 0.01`);
        nameLabel.setAttribute('color', '#FFFFFF');
        nameLabel.setAttribute('width', data.width - 0.4);
        el.appendChild(nameLabel);
        
        const nameBg = document.createElement('a-plane');
        nameBg.setAttribute('width', data.width - 0.4);
        nameBg.setAttribute('height', 0.4);
        nameBg.setAttribute('position', '0 -0.2 0.01');
        nameBg.setAttribute('color', '#2A2A2A');
        nameBg.setAttribute('class', 'clickable interactive');
        el.appendChild(nameBg);
        
        const nameText = document.createElement('a-text');
        nameText.setAttribute('value', 'Click to enter name...');
        nameText.setAttribute('align', 'center');
        nameText.setAttribute('position', '0 -0.2 0.02');
        nameText.setAttribute('color', '#888888');
        nameText.setAttribute('width', data.width - 0.6);
        el.appendChild(nameText);
        
        const capLabel = document.createElement('a-text');
        capLabel.setAttribute('value', 'Capabilities (optional):');
        capLabel.setAttribute('align', 'left');
        capLabel.setAttribute('position', `${-data.width/2 + 0.2} -0.6 0.01`);
        capLabel.setAttribute('color', '#FFFFFF');
        capLabel.setAttribute('width', data.width - 0.4);
        el.appendChild(capLabel);
        
        const capBg = document.createElement('a-plane');
        capBg.setAttribute('width', data.width - 0.4);
        capBg.setAttribute('height', 0.4);
        capBg.setAttribute('position', '0 -0.9 0.01');
        capBg.setAttribute('color', '#2A2A2A');
        capBg.setAttribute('class', 'clickable interactive');
        el.appendChild(capBg);
        
        const capText = document.createElement('a-text');
        capText.setAttribute('value', 'Click to enter capabilities...');
        capText.setAttribute('align', 'center');
        capText.setAttribute('position', '0 -0.9 0.02');
        capText.setAttribute('color', '#888888');
        capText.setAttribute('width', data.width - 0.6);
        el.appendChild(capText);
        
        const createButton = this.createButton(
            'CREATE AGENT',
            { x: 0.9, y: -data.height/2 + 0.4, z: 0.01 },
            () => this.createAgent(),
            '#4CAF50'
        );
        el.appendChild(createButton);
        
        const cancelButton = this.createButton(
            'CANCEL',
            { x: -0.9, y: -data.height/2 + 0.4, z: 0.01 },
            () => this.cancel(),
            '#F44336'
        );
        el.appendChild(cancelButton);
        
        const statusText = document.createElement('a-text');
        statusText.setAttribute('value', '');
        statusText.setAttribute('align', 'center');
        statusText.setAttribute('position', `0 ${-data.height/2 + 0.15} 0.01`);
        statusText.setAttribute('color', '#888888');
        statusText.setAttribute('width', data.width - 0.4);
        statusText.setAttribute('wrap-count', 50);
        el.appendChild(statusText);
        
        this.nameText = nameText;
        this.nameBg = nameBg;
        this.capText = capText;
        this.capBg = capBg;
        this.statusText = statusText;
        this.agentName = '';
        this.capabilities = '';
        
        nameBg.addEventListener('click', () => this.onNameClick());
        capBg.addEventListener('click', () => this.onCapabilitiesClick());
        
        this.updateModelSelection('llama3.2');
        
        if (!data.visible) {
            el.setAttribute('visible', false);
        }
    },
    
    createModelButton: function(model, position) {
        const button = document.createElement('a-entity');
        
        const bg = document.createElement('a-plane');
        bg.setAttribute('width', 1.1);
        bg.setAttribute('height', 0.6);
        bg.setAttribute('color', CONFIG.AGENTS.colors[model.name]);
        bg.setAttribute('opacity', 0.3);
        bg.setAttribute('class', 'clickable interactive');
        button.appendChild(bg);
        
        const nameEl = document.createElement('a-text');
        nameEl.setAttribute('value', model.label);
        nameEl.setAttribute('align', 'center');
        nameEl.setAttribute('position', '0 0.1 0.01');
        nameEl.setAttribute('color', '#FFFFFF');
        nameEl.setAttribute('width', 1);
        button.appendChild(nameEl);
        
        const desc = document.createElement('a-text');
        desc.setAttribute('value', model.desc);
        desc.setAttribute('align', 'center');
        desc.setAttribute('position', '0 -0.1 0.01');
        desc.setAttribute('color', '#AAAAAA');
        desc.setAttribute('width', 1);
        desc.setAttribute('wrap-count', 15);
        button.appendChild(desc);
        
        button.setAttribute('position', `${position.x} ${position.y} ${position.z}`);
        
        button.addEventListener('click', () => {
            this.selectedModel = model.name;
            this.updateModelSelection(model.name);
        });
        
        button.userData = { bg, modelName: model.name };
        
        return button;
    },
    
    updateModelSelection: function(modelName) {
        this.modelButtons.forEach(({ name, element }) => {
            const bg = element.userData.bg;
            if (name === modelName) {
                bg.setAttribute('opacity', 0.8);
                bg.setAttribute('scale', '1.05 1.05 1');
            } else {
                bg.setAttribute('opacity', 0.3);
                bg.setAttribute('scale', '1 1 1');
            }
        });
    },
    
    createButton: function(label, position, onClick, color = '#2196F3') {
        const button = document.createElement('a-entity');
        
        const bg = document.createElement('a-plane');
        bg.setAttribute('width', 1.6);
        bg.setAttribute('height', 0.35);
        bg.setAttribute('color', color);
        bg.setAttribute('opacity', 0.9);
        bg.setAttribute('class', 'clickable interactive');
        button.appendChild(bg);
        
        const text = document.createElement('a-text');
        text.setAttribute('value', label);
        text.setAttribute('align', 'center');
        text.setAttribute('position', '0 0 0.01');
        text.setAttribute('color', '#FFFFFF');
        text.setAttribute('width', 1.5);
        button.appendChild(text);
        
        button.setAttribute('position', `${position.x} ${position.y} ${position.z}`);
        
        button.addEventListener('mouseenter', () => {
            bg.setAttribute('scale', '1.05 1.05 1');
            bg.setAttribute('opacity', 1);
        });
        
        button.addEventListener('mouseleave', () => {
            bg.setAttribute('scale', '1 1 1');
            bg.setAttribute('opacity', 0.9);
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
    
    onNameClick: function() {
        if (!AFRAME.utils.device.checkHeadsetConnected()) {
            const name = prompt('Enter agent name:');
            if (name) {
                this.agentName = name;
                this.nameText.setAttribute('value', name);
                this.nameText.setAttribute('color', '#FFFFFF');
            }
        } else {
            this.el.sceneEl.systems['status-messages'].showMessage(
                'VR keyboard not available. Use desktop for testing.',
                'info',
                2000
            );
        }
    },
    
    onCapabilitiesClick: function() {
        if (!AFRAME.utils.device.checkHeadsetConnected()) {
            const cap = prompt('Enter capabilities (comma separated):');
            if (cap) {
                this.capabilities = cap;
                this.capText.setAttribute('value', cap);
                this.capText.setAttribute('color', '#FFFFFF');
            }
        } else {
            this.el.sceneEl.systems['status-messages'].showMessage(
                'VR keyboard not available. Use desktop for testing.',
                'info',
                2000
            );
        }
    },
    
    createAgent: function() {
        if (!this.agentName || this.agentName.trim() === '') {
            this.updateStatus('Please enter agent name', '#FF9800');
            return;
        }
        
        const agentData = {
            name: this.agentName.trim(),
            model: this.selectedModel,
            capabilities: this.capabilities ? 
                this.capabilities.split(',').map(c => c.trim()).filter(c => c) : 
                []
        };
        
        this.updateStatus('Creating agent...', '#2196F3');
        
        this.el.emit('agent-create-requested', agentData);
        
        setTimeout(() => {
            this.updateStatus('Agent created successfully!', '#4CAF50');
            setTimeout(() => {
                this.resetForm();
                this.toggle();
            }, 1500);
        }, 1000);
    },
    
    cancel: function() {
        this.resetForm();
        this.toggle();
    },
    
    resetForm: function() {
        this.agentName = '';
        this.capabilities = '';
        this.selectedModel = 'llama3.2';
        
        this.nameText.setAttribute('value', 'Click to enter name...');
        this.nameText.setAttribute('color', '#888888');
        
        this.capText.setAttribute('value', 'Click to enter capabilities...');
        this.capText.setAttribute('color', '#888888');
        
        this.updateModelSelection('llama3.2');
        this.updateStatus('', '#888888');
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

export default 'agent-creator';
