/**
 * Utilidades para VR
 */

/**
 * Genera un color a partir de un string
 */
export function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const h = hash % 360;
    return `hsl(${h}, 70%, 50%)`;
}

/**
 * Calcula posición orbital
 */
export function calculateOrbitPosition(angle, radius, height) {
    return {
        x: Math.cos(angle) * radius,
        y: height,
        z: Math.sin(angle) * radius
    };
}

/**
 * Interpolación lineal
 */
export function lerp(start, end, t) {
    return start + (end - start) * t;
}

/**
 * Clamp value
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Crear texto con fondo en VR
 */
export function createTextWithBackground(text, options = {}) {
    const entity = document.createElement('a-entity');
    
    // Background
    const bg = document.createElement('a-plane');
    bg.setAttribute('width', options.width || 2);
    bg.setAttribute('height', options.height || 0.5);
    bg.setAttribute('color', options.bgColor || '#000000');
    bg.setAttribute('opacity', options.opacity || 0.8);
    entity.appendChild(bg);
    
    // Text
    const textEl = document.createElement('a-text');
    textEl.setAttribute('value', text);
    textEl.setAttribute('align', 'center');
    textEl.setAttribute('position', '0 0 0.01');
    textEl.setAttribute('color', options.textColor || '#FFFFFF');
    textEl.setAttribute('width', (options.width || 2) * 0.9);
    entity.appendChild(textEl);
    
    return entity;
}

/**
 * Animar propiedad de A-Frame
 */
export function animateProperty(element, property, to, duration = 500) {
    if (!element) return;
    
    element.setAttribute('animation', {
        property: property,
        to: to,
        dur: duration,
        easing: 'easeInOutQuad'
    });
}

/**
 * Mostrar notificación en VR
 */
export function showNotification(message, type = 'info', duration = 3000) {
    const scene = document.querySelector('a-scene');
    if (!scene || !scene.systems['status-messages']) {
        console.log(`[Notification] ${message}`);
        return;
    }
    
    scene.systems['status-messages'].showMessage(message, type, duration);
}

/**
 * Detectar si está en modo VR
 */
export function isVRMode() {
    const scene = document.querySelector('a-scene');
    return scene && scene.is('vr-mode');
}

/**
 * Formatear fecha
 */
export function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

/**
 * Generar ID único
 */
export function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
