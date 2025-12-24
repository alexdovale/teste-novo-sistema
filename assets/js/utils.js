// assets/js/utils.js
// Funções auxiliares puras para formatação, normalização e UI genérica.

/**
 * Remove acentos e converte para minúsculas para facilitar a pesquisa.
 * @param {string} str - O texto a normalizar.
 * @returns {string} Texto normalizado.
 */
export const normalizeText = (str) => {
    if (!str) return '';
    return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

/**
 * Copia um texto para a área de transferência e exibe uma notificação.
 * Usa um elemento textarea temporário para maior compatibilidade.
 * @param {string} text - O texto a copiar.
 * @param {string} message - A mensagem de sucesso.
 * @param {function} notificationCallback - Função para exibir a notificação (opcional).
 */
export const copyToClipboard = (text, message, notificationCallback) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Garante que o elemento não é visível
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful && notificationCallback) {
            notificationCallback(message, 'info');
        } else if (!successful && notificationCallback) {
            notificationCallback('Não foi possível copiar o texto.', 'error');
        }
    } catch (err) {
        console.error('Erro ao copiar', err);
        if (notificationCallback) notificationCallback('Erro ao copiar.', 'error');
    }
    
    document.body.removeChild(textArea);
};

/**
 * Exibe uma notificação flutuante no topo direito da tela.
 * @param {string} message - A mensagem a exibir.
 * @param {string} type - O tipo ('success', 'error', 'info').
 */
export const showNotification = (message, type = 'success') => {
    const colors = { 
        info: 'bg-blue-500', 
        error: 'bg-red-500', 
        success: 'bg-green-600',
        warning: 'bg-yellow-500'
    };
    
    // Fallback para verde se o tipo não existir
    const colorClass = colors[type] || colors.success;

    const notification = document.createElement('div');
    notification.className = `fixed top-5 right-5 ${colorClass} text-white py-3 px-6 rounded-lg shadow-lg z-[9999] transition-all duration-300 transform translate-x-full opacity-0 flex items-center gap-2`;
    
    // Ícone simples baseado no tipo (opcional)
    let icon = '';
    if (type === 'success') icon = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
    if (type === 'error') icon = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
    
    notification.innerHTML = `${icon}<span>${message}</span>`;
    document.body.appendChild(notification);

    // Animação de entrada
    requestAnimationFrame(() => {
        notification.classList.remove('translate-x-full', 'opacity-0');
    });

    // Remove após 3 segundos
    setTimeout(() => {
        notification.classList.add('translate-x-full', 'opacity-0');
        notification.addEventListener('transitionend', () => {
            if (notification.parentElement) {
                notification.remove();
            }
        });
    }, 3500);
};

/**
 * Garante a formatação segura de strings de data ISO ou Timestamps do Firestore.
 * @param {string|object} timeStamp - String ISO ou objeto Timestamp {seconds, nanoseconds}.
 * @returns {string} Hora formatada (HH:mm) ou 'N/A'.
 */
export function formatTime(timeStamp) {
    if (!timeStamp) return 'N/A';

    let date;
    // Verifica se é um objeto Timestamp do Firebase
    if (typeof timeStamp === 'object' && timeStamp !== null && 'seconds' in timeStamp) {
        date = new Date(timeStamp.seconds * 1000);
    } 
    // Tenta usar a string diretamente
    else {
        date = new Date(timeStamp);
    }
    
    if (isNaN(date.getTime()) || date.getTime() === 0) {
        return 'N/A'; 
    }

    return date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

/**
 * Formata um valor numérico para moeda brasileira (BRL).
 * @param {number} value - O valor a formatar.
 * @returns {string} String formatada (ex: R$ 1.200,50).
 */
export const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { 
        style: 'currency', 
        currency: 'BRL' 
    }).format(value);
};

/**
 * Converte uma string de moeda (R$ 1.000,00) para número float (1000.00).
 * @param {string} str - A string formatada.
 * @returns {number} O valor numérico.
 */
export const parseCurrency = (str) => {
    if (!str) return 0;
    // Remove tudo que não é dígito ou vírgula, troca vírgula por ponto
    return parseFloat(str.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
};