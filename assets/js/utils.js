// utils.js - Funções auxiliares

export const normalizeText = (str) => {
    if (!str) return '';
    return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

export const copyToClipboard = (text, message, notificationCallback) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        if (notificationCallback) notificationCallback(message, 'info');
    } catch (err) {
        if (notificationCallback) notificationCallback('Erro ao copiar.', 'error');
    }
    document.body.removeChild(textArea);
};

export const showNotification = (message, type = 'success') => {
    const colors = { info: 'blue', error: 'red', success: 'green' };
    const notification = document.createElement('div');
    notification.className = `fixed top-5 right-5 bg-${colors[type]}-500 text-white py-3 px-6 rounded-lg shadow-lg z-[100] transition-transform transform translate-x-full`;
    notification.textContent = message;
    document.body.appendChild(notification);

    requestAnimationFrame(() => {
        notification.classList.remove('translate-x-full');
    });

    setTimeout(() => {
        notification.classList.add('translate-x-full');
        notification.addEventListener('transitionend', () => notification.remove());
    }, 3000);
};

/**
 * Garante a formatação segura de strings de data ISO ou Timestamp.
 */
export function formatTime(timeStamp) {
    if (!timeStamp) return 'N/A';

    let date;
    // Verifica se é um objeto Timestamp do Firebase
    if (typeof timeStamp === 'object' && timeStamp.seconds) {
        date = new Date(timeStamp.seconds * 1000);
    } 
    // Tenta usar a string diretamente
    else {
        date = new Date(timeStamp);
    }
    
    if (isNaN(date) || date.getTime() === 0) {
        return 'N/A'; 
    }

    return date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}
