import CONFIG from '../config.js';
import { createLogger } from '../utils/logs.js';

const ShowLogs = undefined;
const log = createLogger('[AgentsManager]', ShowLogs);

/**
 * Componente Agents Manager - Panel para exportar/importar agentes
 */
AFRAME.registerComponent('agents-manager', {
    schema: {
        visible: { type: 'boolean', default: false },
    },

    init: function() {
        const el = this.el;
        const data = this.data;

        // Crear panel de fondo
        const background = document.createElement('a-plane');
        background.setAttribute('width', 4);
        background.setAttribute('height', 3);
        background.setAttribute('position', '0 1.5 -3');
        background.setAttribute('rotation', '0 0 0');
        background.setAttribute('color', '#1a1a2e');
        background.setAttribute('opacity', 0.95);
        el.appendChild(background);

        // Crear título
        const title = document.createElement('a-text');
        title.setAttribute('value', 'AGENTS MANAGER');
        title.setAttribute('align', 'center');
        title.setAttribute('position', '0 1.3 -2.98');
        title.setAttribute('scale', '1.5 1.5 1.5');
        title.setAttribute('color', '#00BCD4');
        el.appendChild(title);

        // Container para botones
        const buttonContainer = document.createElement('a-entity');
        buttonContainer.setAttribute('position', '0 0.5 -2.98');
        el.appendChild(buttonContainer);

        // Botón REFRESH
        const refreshBtn = this.createButton({
            text: 'REFRESH LIST',
            position: '-1.5 0.5 0',
            color: '#9C27B0',
            hoverColor: '#7b1fa2',
            callback: () => this.handleRefresh()
        });
        buttonContainer.appendChild(refreshBtn);

        // Botón EXPORT
        const exportBtn = this.createButton({
            text: 'EXPORT AGENTS',
            position: '0 0.5 0',
            color: '#4CAF50',
            hoverColor: '#45a049',
            callback: () => this.handleExport()
        });
        buttonContainer.appendChild(exportBtn);

        // Botón IMPORT
        const importBtn = this.createButton({
            text: 'IMPORT AGENTS',
            position: '1.5 0.5 0',
            color: '#2196F3',
            hoverColor: '#0b7dda',
            callback: () => this.handleImport()
        });
        buttonContainer.appendChild(importBtn);

        // Botón RELOAD
        const reloadBtn = this.createButton({
            text: 'RELOAD FROM FILE',
            position: '0 -0.3 0',
            color: '#FF9800',
            hoverColor: '#e68900',
            callback: () => this.handleReload()
        });
        buttonContainer.appendChild(reloadBtn);

        // Status message
        const statusText = document.createElement('a-text');
        statusText.setAttribute('value', '');
        statusText.setAttribute('align', 'center');
        statusText.setAttribute('position', '0 -1 -2.98');
        statusText.setAttribute('width', 3.5);
        statusText.setAttribute('scale', '0.8 0.8 0.8');
        statusText.setAttribute('color', '#FFFFFF');
        statusText.setAttribute('wrap-count', 50);
        el.appendChild(statusText);

        this.statusText = statusText;
        this.exportBtn = exportBtn;
        this.importBtn = importBtn;
        this.reloadBtn = reloadBtn;
        this.background = background;
        this.panel = el;

        // Hidden by default
        this.setVisibility(data.visible);

        // Escuchar eventos de visibilidad
        el.addEventListener('manager-toggle', () => this.toggleVisibility());
    },

    createButton: function({ text, position, color, hoverColor, callback }) {
        const btn = document.createElement('a-entity');
        btn.setAttribute('position', position);
        btn.setAttribute('class', 'clickable interactive');

        // Fondo del botón
        const btnBg = document.createElement('a-plane');
        btnBg.setAttribute('width', 1.2);
        btnBg.setAttribute('height', 0.4);
        btnBg.setAttribute('color', color);
        btnBg.setAttribute('opacity', 0.8);
        btn.appendChild(btnBg);

        // Texto del botón
        const btnText = document.createElement('a-text');
        btnText.setAttribute('value', text);
        btnText.setAttribute('align', 'center');
        btnText.setAttribute('position', '0 0 0.01');
        btnText.setAttribute('scale', '0.7 0.7 0.7');
        btnText.setAttribute('color', '#FFFFFF');
        btn.appendChild(btnText);

        // Event listeners
        btn.addEventListener('click', callback);
        btn.addEventListener('mouseenter', () => {
            btnBg.setAttribute('color', hoverColor);
            btnBg.setAttribute('scale', '1.05 1.05 1.05');
        });
        btn.addEventListener('mouseleave', () => {
            btnBg.setAttribute('color', color);
            btnBg.setAttribute('scale', '1 1 1');
        });

        this.btnBg = btnBg;
        return btn;
    },

    handleRefresh: async function() {
        try {
            this.updateStatus('Refreshing agents list...', 'info');
            
            const url = `${CONFIG.API_BASE_URL}/agents`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const agents = await response.json();
            const agentCount = agents.length;

            this.updateStatus(`✓ Loaded ${agentCount} agents`, 'success');
            log(`Loaded ${agentCount} agents from API`);

            // Disparar evento para recargar en la UI
            document.querySelector('a-scene').dispatchEvent(new CustomEvent('agents-updated', {
                detail: { agents, timestamp: new Date().toISOString() }
            }));

        } catch (error) {
            this.updateStatus(`✗ Refresh failed: ${error.message}`, 'error');
            log.error('Refresh error:', error);
        }
    },

    handleExport: async function() {
        try {
            this.updateStatus('Exporting agents...', 'info');
            
            const url = `${CONFIG.API_BASE_URL}/agents/export`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const agentsData = data.agents || {};
            const agentCount = Object.keys(agentsData).length;

            // Crear blob y descargar
            const blob = new Blob([JSON.stringify(agentsData, null, 2)], { type: 'application/json' });
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `agents-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(downloadUrl);

            this.updateStatus(`✓ Exported ${agentCount} agents`, 'success');
            log(`Exported ${agentCount} agents`);

        } catch (error) {
            this.updateStatus(`✗ Export failed: ${error.message}`, 'error');
            log.error('Export error:', error);
        }
    },

    handleImport: function() {
        try {
            this.updateStatus('Select JSON file to import...', 'info');
            
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                try {
                    this.updateStatus('Reading file...', 'info');
                    const text = await file.text();
                    const agentsData = JSON.parse(text);

                    // Validar estructura
                    if (!agentsData || typeof agentsData !== 'object') {
                        throw new Error('Invalid JSON: must be an object');
                    }

                    this.updateStatus('Uploading agents...', 'info');

                    const url = `${CONFIG.API_BASE_URL}/agents/bulk-update`;
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ agents: agentsData })
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    const result = await response.json();
                    const updatedCount = result.updated_count || 0;
                    const errors = result.errors || [];

                    if (errors.length > 0) {
                        this.updateStatus(`✓ Updated ${updatedCount} agents (${errors.length} errors)`, 'warning');
                        log.warn('Import with errors:', errors);
                    } else {
                        this.updateStatus(`✓ Updated ${updatedCount} agents successfully`, 'success');
                        log(`Imported ${updatedCount} agents`);
                    }

                    // Disparar evento para recargar agentes en la UI
                    document.querySelector('a-scene').dispatchEvent(new CustomEvent('agents-updated'));

                } catch (error) {
                    this.updateStatus(`✗ Import failed: ${error.message}`, 'error');
                    log.error('Import error:', error);
                }
            });

            input.click();

        } catch (error) {
            this.updateStatus(`✗ Error: ${error.message}`, 'error');
            log.error('Import setup error:', error);
        }
    },

    handleReload: async function() {
        try {
            this.updateStatus('Reloading from file...', 'info');

            const url = `${CONFIG.API_BASE_URL}/agents/reload`;
            const response = await fetch(url, { method: 'POST' });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            const agentCount = result.agents_after || 0;

            this.updateStatus(`✓ Reloaded ${agentCount} agents from file`, 'success');
            log(`Reloaded agents: ${agentCount}`);

            // Disparar evento para recargar agentes en la UI
            document.querySelector('a-scene').dispatchEvent(new CustomEvent('agents-updated'));

        } catch (error) {
            this.updateStatus(`✗ Reload failed: ${error.message}`, 'error');
            log.error('Reload error:', error);
        }
    },

    updateStatus: function(message, type = 'info') {
        if (this.statusText) {
            this.statusText.setAttribute('value', message);

            const colors = {
                info: '#00BCD4',
                success: '#4CAF50',
                warning: '#FF9800',
                error: '#F44336'
            };

            this.statusText.setAttribute('color', colors[type] || colors.info);
        }
    },

    setVisibility: function(visible) {
        const opacity = visible ? 0.95 : 0;
        const pointerEvents = visible ? 'auto' : 'none';

        if (this.background) this.background.setAttribute('opacity', opacity);
        if (this.panel) this.panel.style.pointerEvents = pointerEvents;

        this.data.visible = visible;
    },

    toggleVisibility: function() {
        this.setVisibility(!this.data.visible);
    },

    remove: function() {
        // Cleanup
    }
});
