import CONFIG from '../config.js';

/**
 * Componente Query Panel - Panel interactivo para enviar queries
 */
AFRAME.registerComponent('query-panel', {
    schema: {
        width: { type: 'number', default: 3 },
        height: { type: 'number', default: 1.25 },
        visible: { type: 'boolean', default: true }
    },
    
    init: function() {
        const el = this.el;
        const data = this.data;
        
        // Almacenar botones para detección de mouse
        this.buttons = [];
        
        const sendButton = this.createButton(
            'SEND CUSTOM QUERY',
            { x: 0, y: 0, z: 0.01 },
            () => this.sendCustomQuery(),
            CONFIG.ORCHESTRATOR.color,
            data.width - 0.4
        );
        el.appendChild(sendButton);
        this.buttons.push(sendButton);
        
        const predefinedQueries = [
            'Cuéntame un chiste'
        ];
        
        const queryButtons = [];
        predefinedQueries.forEach((query, index) => {
            const button = this.createButton(
                query,
                { x: 0, y: 0.4 + (index * 0.4), z: 0.01 },
                () => this.sendQuery(query),
                '#21f33d',
                data.width - 0.4
            );
            el.appendChild(button);
            this.buttons.push(button);
            queryButtons.push(button);
        });
        
        // Crear elemento de estado
        const statusText = document.createElement('a-text');
        statusText.setAttribute('value', '');
        statusText.setAttribute('align', 'center');
        statusText.setAttribute('position', `0 -0.4 0.01`);
        statusText.setAttribute('color', '#888888');
        statusText.setAttribute('width', data.width - 0.4);
        statusText.setAttribute('wrap-count', 50);
        el.appendChild(statusText);
        
        this.statusText = statusText;
        this.queryButtons = queryButtons;
        
        // Agregar listener de mouse global para detectar clicks en 3D
        this.addMouseClickListener();
    },
    addMouseClickListener: function() {
        const self = this;
        const canvas = document.querySelector('canvas');
        
        if (!canvas) {
            console.warn('[Query Panel] Canvas not found');
            return;
        }
        
        canvas.addEventListener('click', (evt) => {
            console.log('[Query Panel] Canvas click detected');
            
            // Obtener cámara
            const camera = document.querySelector('[camera]');
            
            if (!camera) {
                console.warn('[Query Panel] Camera not found');
                return;
            }
            
            // Crear raycaster para detectar qué objeto fue clickeado
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();
            
            // Calcular posición del mouse en coordenadas normalizadas
            const rect = canvas.getBoundingClientRect();
            mouse.x = (evt.clientX - rect.left) / rect.width * 2 - 1;
            mouse.y = -(evt.clientY - rect.top) / rect.height * 2 + 1;
            
            // Obtener la cámara THREE.js
            const threeCamera = camera.getObject3D('camera');
            if (!threeCamera) {
                console.warn('[Query Panel] THREE camera not found');
                return;
            }
            
            // Configurar raycaster
            raycaster.setFromCamera(mouse, threeCamera);
            
            // Obtener todos los objetos 3D de los botones (buscar meshes dentro de cada botón)
            const buttonMeshes = [];
            self.buttons.forEach((button, idx) => {
                const obj3d = button.object3D;
                console.log(`[Query Panel] Button ${idx} object3D:`, obj3d);
                
                // Obtener todos los meshes del botón recursivamente
                obj3d.traverse((child) => {
                    if (child.isMesh) {
                        console.log(`[Query Panel] Found mesh in button ${idx}:`, child);
                        buttonMeshes.push({
                            mesh: child,
                            buttonIndex: idx,
                            button: button
                        });
                    }
                });
            });
            
            console.log('[Query Panel] Total meshes found:', buttonMeshes.length);
            
            // Crear array de solo meshes para raycaster
            const meshesOnly = buttonMeshes.map(m => m.mesh);
            
            // Detectar intersecciones
            const intersects = raycaster.intersectObjects(meshesOnly, false);
            
            console.log('[Query Panel] Intersections found:', intersects.length);
            
            if (intersects.length > 0) {
                console.log('[Query Panel] MOUSE CLICK on button detected!');
                const clickedMesh = intersects[0].object;
                
                // Buscar cuál botón contiene este mesh
                for (let i = 0; i < buttonMeshes.length; i++) {
                    if (buttonMeshes[i].mesh === clickedMesh) {
                        console.log(`[Query Panel] Clicked on button ${i}`);
                        buttonMeshes[i].button.emit('click', { intersection: intersects[0] });
                        break;
                    }
                }
            } else {
                console.log('[Query Panel] No intersection with buttons');
            }
        });
    },
    
    addMouseClickListener: function() {
        const self = this;
        const canvas = document.querySelector('canvas');
        
        if (!canvas) {
            console.warn('[Query Panel] Canvas not found');
            return;
        }
        
        canvas.addEventListener('click', (evt) => {
            console.log('[Query Panel] Canvas click detected');
            
            // Obtener cámara y raycaster
            const camera = document.querySelector('[camera]');
            const scene = document.querySelector('a-scene');
            
            if (!camera || !scene) {
                console.warn('[Query Panel] Camera or scene not found');
                return;
            }
            
            // Crear raycaster para detectar qué objeto fue clickeado
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();
            
            // Calcular posición del mouse en coordenadas normalizadas
            const rect = canvas.getBoundingClientRect();
            mouse.x = (evt.clientX - rect.left) / rect.width * 2 - 1;
            mouse.y = -(evt.clientY - rect.top) / rect.height * 2 + 1;
            
            // Obtener la cámara THREE.js
            const threeCamera = camera.getObject3D('camera');
            if (!threeCamera) {
                console.warn('[Query Panel] THREE camera not found');
                return;
            }
            
            // Configurar raycaster
            raycaster.setFromCamera(mouse, threeCamera);
            
            // Obtener todos los objetos 3D de los botones
            const buttonObjects = [];
            self.buttons.forEach(button => {
                const mesh = button.getObject3D('mesh');
                if (mesh) {
                    buttonObjects.push(mesh);
                }
            });
            
            // Detectar intersecciones
            const intersects = raycaster.intersectObjects(buttonObjects, true);
            
            if (intersects.length > 0) {
                console.log('[Query Panel] MOUSE CLICK on button detected');
                // Disparar evento click en el objeto intersectado
                const clickedMesh = intersects[0].object;
                const parentButton = clickedMesh.parent;
                
                // Buscar el botón en la lista
                self.buttons.forEach((button, index) => {
                    const buttonMesh = button.getObject3D('mesh');
                    if (buttonMesh && (buttonMesh === clickedMesh || buttonMesh.parent === parentButton)) {
                        console.log(`[Query Panel] Triggering click on button ${index}`);
                        button.emit('click', { intersection: null });
                    }
                });
            }
        });
    },
    
    createButton: function(label, position, onClick, color = '#21f33d', width = null) {
        const button = document.createElement('a-entity');
        button.setAttribute('class', 'clickable interactive');
        
        const buttonWidth = width || 3.5;
        
        const bg = document.createElement('a-plane');
        bg.setAttribute('width', buttonWidth);
        bg.setAttribute('height', 0.3);
        bg.setAttribute('color', color);
        bg.setAttribute('opacity', 0.8);
        bg.setAttribute('class', 'clickable interactive');
        button.appendChild(bg);
        
        const text = document.createElement('a-text');
        text.setAttribute('value', label);
        text.setAttribute('align', 'center');
        text.setAttribute('position', '0 0 0.01');
        text.setAttribute('color', '#000000');
        text.setAttribute('width', buttonWidth - 0.4);
        text.setAttribute('wrap-count', 30);
        button.appendChild(text);
        
        button.setAttribute('position', `${position.x} ${position.y} ${position.z}`);
        
        // Eventos visuales del botón
        button.addEventListener('mouseenter', () => {
            console.log(`[Query Panel] Mouse enter button: ${label}`);
            bg.setAttribute('scale', '1.05 1.05 1');
            bg.setAttribute('opacity', 1);
        });
        
        button.addEventListener('mouseleave', () => {
            console.log(`[Query Panel] Mouse leave button: ${label}`);
            bg.setAttribute('scale', '1 1 1');
            bg.setAttribute('opacity', 0.8);
        });
        
        // Click event - funciona con mouse y raycaster
        button.addEventListener('click', (evt) => {
            console.log(`[Query Panel] CLICK DETECTED on button: ${label}`, {
                eventType: evt.type,
                hasDetail: !!evt.detail,
                hasIntersection: evt.detail && evt.detail.intersection ? true : false,
                clickSource: evt.detail && evt.detail.intersection ? 'RAYCASTER' : 'MOUSE'
            });
            
            // Ejecutar acción tanto para mouse como para raycaster
            bg.setAttribute('animation__click', {
                property: 'scale',
                from: '1 1 1',
                to: '0.95 0.95 1',
                dur: 100,
                dir: 'alternate',
                loop: 1
            });
            
            console.log(`[Query Panel] Executing action for: ${label}`);
            setTimeout(onClick, 100);
        });
        
        // Agregar evento adicional para detectar clicks en cualquier parte del botón
        button.addEventListener('touchend', () => {
            console.log(`[Query Panel] Touch end button: ${label}`);
            onClick();
        });
        
        return button;
    },
    
    sendQuery: function(query) {
        this.updateStatus('Sending query...', '#2196F3');
        
        this.el.emit('query-submitted', { query: query });
        
        setTimeout(() => {
            this.updateStatus('Query sent successfully', '#614caf');
            setTimeout(() => {
                this.updateStatus('', '#888888');
            }, 2000);
        }, 500);
    },
    
    sendCustomQuery: function() {
        const query = prompt('Enter your query:');
        if (query && query.trim() !== '') {
            this.sendQuery(query);
        }
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
