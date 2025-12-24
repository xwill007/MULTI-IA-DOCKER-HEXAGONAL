import CONFIG from '../config.js';import { createLogger } from '../utils/logs.js'

// Control de logs para este componente (undefined = usa global)
const ShowLogs = undefined;
const log = createLogger('[Conversation History]', ShowLogs);
/**
 * Componente Conversation History - Panel que muestra historial de conversaciones
 */
AFRAME.registerComponent('conversation-history', {
    schema: {
        width: { type: 'number', default: 4 },
        height: { type: 'number', default: 3 },
        visible: { type: 'boolean', default: true },
        maxItems: { type: 'number', default: 20 }
    },
    
    init: function() {
        const el = this.el;
        const data = this.data;
        
        // Estado del componente
        this.conversations = [];
        this.selectedConversation = null;
        this.currentPage = 0;
        this.itemsPerPage = 10;
        
        // Crear panel de fondo
        const background = document.createElement('a-plane');
        background.setAttribute('width', data.width);
        background.setAttribute('height', data.height);
        background.setAttribute('color', '#1a1a1a');
        background.setAttribute('opacity', 0.9);
        el.appendChild(background);
        
        // Título
        const title = document.createElement('a-text');
        title.setAttribute('value', 'HISTORIAL DE CONVERSACIONES');
        title.setAttribute('align', 'center');
        title.setAttribute('position', `0 ${data.height / 2 - 0.2} 0.01`);
        title.setAttribute('color', CONFIG.ORCHESTRATOR.color);
        title.setAttribute('width', data.width - 0.4);
        el.appendChild(title);
        
        // Área de contenido (lista de conversaciones)
        const contentContainer = document.createElement('a-entity');
        contentContainer.setAttribute('id', 'conversation-list');
        contentContainer.setAttribute('position', `0 ${data.height / 2 - 0.5} 0.01`);
        el.appendChild(contentContainer);
        this.contentContainer = contentContainer;
        
        // Botones de navegación
        const prevButton = this.createButton(
            '< ANTERIOR',
            { x: -data.width / 2 + 0.5, y: -data.height / 2 + 0.2, z: 0.01 },
            () => this.previousPage(),
            '#4A90E2',
            1
        );
        el.appendChild(prevButton);
        
        const nextButton = this.createButton(
            'SIGUIENTE >',
            { x: data.width / 2 - 0.5, y: -data.height / 2 + 0.2, z: 0.01 },
            () => this.nextPage(),
            '#4A90E2',
            1
        );
        el.appendChild(nextButton);
        
        // Botón de refrescar
        const refreshButton = this.createButton(
            'REFRESCAR',
            { x: 0, y: -data.height / 2 + 0.2, z: 0.01 },
            () => this.loadConversations(),
            '#4CAF50',
            1.2
        );
        el.appendChild(refreshButton);
        
        // Texto de estado
        const statusText = document.createElement('a-text');
        statusText.setAttribute('value', 'Cargando conversaciones...');
        statusText.setAttribute('align', 'center');
        statusText.setAttribute('position', `0 0 0.01`);
        statusText.setAttribute('color', '#888888');
        statusText.setAttribute('width', data.width - 0.4);
        el.appendChild(statusText);
        this.statusText = statusText;
        
        // Botón de cerrar
        const closeButton = this.createButton(
            'X',
            { x: data.width / 2 - 0.15, y: data.height / 2 - 0.15, z: 0.01 },
            () => this.close(),
            '#F44336',
            0.3
        );
        el.appendChild(closeButton);
        
        // Cargar conversaciones automáticamente
        setTimeout(() => this.loadConversations(), 500);
    },
    
    /**
     * Cargar conversaciones desde la API
     */
    async loadConversations() {
        log('Loading conversations...');
        this.updateStatus('Cargando conversaciones...');
        
        try {
            const apiClient = window.apiClient;
            if (!apiClient) {
                throw new Error('API client not available');
            }
            
            const data = await apiClient.getConversations();
            
            // Convertir objeto conversations a array
            const conversationsArray = Object.values(data.conversations || {});
            
            // Ordenar por updated_at (más recientes primero)
            conversationsArray.sort((a, b) => {
                return new Date(b.updated_at) - new Date(a.updated_at);
            });
            
            // Limitar a maxItems más recientes
            this.conversations = conversationsArray.slice(0, this.data.maxItems);
            
            log('Loaded conversations:', this.conversations.length);
            
            if (this.conversations.length === 0) {
                this.updateStatus('No hay conversaciones guardadas');
            } else {
                this.updateStatus(`${this.conversations.length} conversaciones encontradas`);
                this.renderConversations();
            }
            
        } catch (error) {
            log.error('Failed to load conversations:', error);
            this.updateStatus('Error al cargar conversaciones');
        }
    },
    
    /**
     * Renderizar lista de conversaciones
     */
    renderConversations() {
        // Limpiar contenido actual
        while (this.contentContainer.firstChild) {
            this.contentContainer.removeChild(this.contentContainer.firstChild);
        }
        
        const startIdx = this.currentPage * this.itemsPerPage;
        const endIdx = Math.min(startIdx + this.itemsPerPage, this.conversations.length);
        const pageConversations = this.conversations.slice(startIdx, endIdx);
        
        if (pageConversations.length === 0) {
            const emptyText = document.createElement('a-text');
            emptyText.setAttribute('value', 'No hay conversaciones en esta página');
            emptyText.setAttribute('align', 'center');
            emptyText.setAttribute('position', '0 0 0');
            emptyText.setAttribute('color', '#888888');
            emptyText.setAttribute('width', this.data.width - 0.4);
            this.contentContainer.appendChild(emptyText);
            return;
        }
        
        // Renderizar cada conversación
        pageConversations.forEach((conv, index) => {
            const itemEntity = this.createConversationItem(conv, index);
            itemEntity.setAttribute('position', `0 ${-index * 0.25} 0`);
            this.contentContainer.appendChild(itemEntity);
        });
        
        // Actualizar estado
        const totalPages = Math.ceil(this.conversations.length / this.itemsPerPage);
        this.updateStatus(`Página ${this.currentPage + 1} de ${totalPages} | Total: ${this.conversations.length} conversaciones`);
    },
    
    /**
     * Crear elemento visual para una conversación
     */
    createConversationItem(conversation, index) {
        const container = document.createElement('a-entity');
        
        // Fondo del item
        const background = document.createElement('a-plane');
        background.setAttribute('width', this.data.width - 0.4);
        background.setAttribute('height', 0.22);
        background.setAttribute('color', index % 2 === 0 ? '#2a2a2a' : '#222222');
        background.setAttribute('opacity', 0.8);
        container.appendChild(background);
        
        // Obtener primer mensaje del usuario
        const firstUserMsg = conversation.messages.find(m => m.role === 'user');
        const preview = firstUserMsg ? firstUserMsg.content.substring(0, 50) : 'Sin mensajes';
        const truncated = preview.length < firstUserMsg?.content.length ? preview + '...' : preview;
        
        // Formatear fecha
        const date = new Date(conversation.updated_at);
        const formattedDate = date.toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Texto principal
        const text = document.createElement('a-text');
        text.setAttribute('value', truncated);
        text.setAttribute('align', 'left');
        text.setAttribute('position', `-${(this.data.width - 0.6) / 2} 0.05 0.01`);
        text.setAttribute('color', '#FFFFFF');
        text.setAttribute('width', this.data.width - 0.8);
        container.appendChild(text);
        
        // Metadata (fecha y cantidad de mensajes)
        const metadata = document.createElement('a-text');
        metadata.setAttribute('value', `${formattedDate} | ${conversation.messages.length} mensajes`);
        metadata.setAttribute('align', 'left');
        metadata.setAttribute('position', `-${(this.data.width - 0.6) / 2} -0.05 0.01`);
        metadata.setAttribute('color', '#888888');
        metadata.setAttribute('width', this.data.width - 0.8);
        metadata.setAttribute('scale', '0.6 0.6 0.6');
        container.appendChild(metadata);
        
        // Hacer clickeable
        background.setAttribute('class', 'clickable');
        background.addEventListener('click', () => {
            this.selectConversation(conversation);
        });
        
        return container;
    },
    
    /**
     * Seleccionar conversación para ver detalles
     */
    selectConversation(conversation) {
        log('Selected conversation:', conversation.conversation_id);
        
        // Emitir evento para que otros componentes puedan reaccionar
        this.el.emit('conversation-selected', {
            conversation_id: conversation.conversation_id,
            conversation: conversation
        });
        
        // Opcionalmente, mostrar detalles en el panel de query
        this.showConversationDetails(conversation);
    },
    
    /**
     * Mostrar detalles de una conversación
     */
    showConversationDetails(conversation) {
        // Limpiar contenido actual
        while (this.contentContainer.firstChild) {
            this.contentContainer.removeChild(this.contentContainer.firstChild);
        }
        
        // Título de la conversación
        const title = document.createElement('a-text');
        title.setAttribute('value', `Conversación: ${conversation.conversation_id.substring(0, 12)}...`);
        title.setAttribute('align', 'center');
        title.setAttribute('position', '0 0 0');
        title.setAttribute('color', CONFIG.ORCHESTRATOR.color);
        title.setAttribute('width', this.data.width - 0.4);
        this.contentContainer.appendChild(title);
        
        // Mensajes
        conversation.messages.slice(-10).forEach((msg, index) => {
            const msgEntity = document.createElement('a-entity');
            msgEntity.setAttribute('position', `0 ${-0.3 - index * 0.2} 0`);
            
            const roleColor = msg.role === 'user' ? '#4A90E2' : '#4CAF50';
            const roleLabel = msg.role === 'user' ? 'Tú' : 'Asistente';
            
            const msgText = document.createElement('a-text');
            msgText.setAttribute('value', `${roleLabel}: ${msg.content.substring(0, 60)}...`);
            msgText.setAttribute('align', 'left');
            msgText.setAttribute('position', `-${(this.data.width - 0.6) / 2} 0 0.01`);
            msgText.setAttribute('color', roleColor);
            msgText.setAttribute('width', this.data.width - 0.6);
            msgText.setAttribute('scale', '0.7 0.7 0.7');
            msgEntity.appendChild(msgText);
            
            this.contentContainer.appendChild(msgEntity);
        });
        
        // Botón de volver
        const backButton = this.createButton(
            'VOLVER A LISTA',
            { x: 0, y: -this.data.height / 2 + 0.6, z: 0.01 },
            () => this.renderConversations(),
            '#9E9E9E',
            1.5
        );
        this.el.appendChild(backButton);
        
        this.updateStatus(`Mostrando últimos 10 mensajes de ${conversation.messages.length} totales`);
    },
    
    /**
     * Página anterior
     */
    previousPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.renderConversations();
        }
    },
    
    /**
     * Página siguiente
     */
    nextPage() {
        const totalPages = Math.ceil(this.conversations.length / this.itemsPerPage);
        if (this.currentPage < totalPages - 1) {
            this.currentPage++;
            this.renderConversations();
        }
    },
    
    /**
     * Actualizar texto de estado
     */
    updateStatus(message) {
        if (this.statusText) {
            this.statusText.setAttribute('value', message);
        }
    },
    
    /**
     * Cerrar panel
     */
    close() {
        this.el.setAttribute('visible', false);
        this.el.emit('history-closed');
    },
    
    /**
     * Crear botón
     */
    createButton(label, position, onClick, color = '#4A90E2', width = 1.5) {
        const button = document.createElement('a-entity');
        button.setAttribute('position', `${position.x} ${position.y} ${position.z}`);
        
        const bg = document.createElement('a-plane');
        bg.setAttribute('width', width);
        bg.setAttribute('height', 0.15);
        bg.setAttribute('color', color);
        bg.setAttribute('opacity', 0.8);
        bg.setAttribute('class', 'clickable');
        button.appendChild(bg);
        
        const text = document.createElement('a-text');
        text.setAttribute('value', label);
        text.setAttribute('align', 'center');
        text.setAttribute('position', '0 0 0.01');
        text.setAttribute('color', '#FFFFFF');
        text.setAttribute('width', width - 0.1);
        button.appendChild(text);
        
        bg.addEventListener('click', onClick);
        
        // Hover effect
        bg.addEventListener('mouseenter', () => {
            bg.setAttribute('opacity', 1);
            bg.setAttribute('scale', '1.05 1.05 1');
        });
        
        bg.addEventListener('mouseleave', () => {
            bg.setAttribute('opacity', 0.8);
            bg.setAttribute('scale', '1 1 1');
        });
        
        return button;
    }
});

export default 'conversation-history';
