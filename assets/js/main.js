// assets/js/main.js
// CONTROLADOR PRINCIPAL: Gerencia o Kanban, Eventos, Drag&Drop e Lógica de Tela.

// 1. IMPORTAÇÕES
import { db, auth } from './firebase-init.js';
import { loginUser, registerUser, logoutUser, monitorAuthState, recoverPassword, reauthenticateUser } from './auth-service.js';
import { setupDetailsModal, openDetailsModal } from './detalhes.js';
import { renderStatisticsModal } from './estatisticas.js';
import { flatSubjects } from './assuntos.js';
import { normalizeText, showNotification, copyToClipboard, formatTime } from './utils.js';

// Imports do Firestore
import { 
    collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, 
    writeBatch, getDoc, setDoc, query, where, getDocs, 
    arrayUnion, arrayRemove, orderBy 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- VARIÁVEIS DE ESTADO GLOBAL ---
let currentPautaId = null;
let currentPautaData = null; // Dados da pauta atual (nome, membros, owner)
let currentUserName = '';
let currentUserId = null;
let allAssisted = []; // Lista local de assistidos para filtragem
let unsubscribeFromAttendances = null; // Para parar de ouvir quando sair da pauta

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Inicializa EmailJS (se disponível)
    if (window.emailjs) emailjs.init("aGL-Q2UJcD2tDpUKq"); // Substitua pela sua Public Key se for diferente

    // Configura o Modal de Detalhes (Injeção de dependências)
    setupDetailsModal({
        db: db,
        getUpdatePayload: (data) => data,
        showNotification: showNotification
    });

    // Inicia Monitoramento de Auth
    initAuthMonitor();
    
    // Configura eventos globais (botões de login, cadastro, etc)
    setupGlobalEventListeners();
});

// --- 1. GERENCIAMENTO DE AUTENTICAÇÃO E TELAS ---

function initAuthMonitor() {
    monitorAuthState((user, userData) => {
        if (user && userData) {
            currentUserId = user.uid;
            currentUserName = userData.name;
            
            if (userData.status === 'approved') {
                showScreen('pauta-selection');
                loadUserPautas();
            } else {
                showScreen('pending-approval');
            }
        } else if (user && !userData) {
            // Caso raro: User criado no Auth mas sem doc no Firestore
            logoutUser();
            showScreen('login');
        } else {
            showScreen('login');
        }
    });
}

function showScreen(screenName) {
    // Esconde todas as telas
    ['login-container', 'register-container', 'pending-container', 'pauta-selection-container', 'app-container'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    // Mostra a desejada
    const map = {
        'login': 'login-container',
        'register': 'register-container',
        'pending-approval': 'pending-container',
        'pauta-selection': 'pauta-selection-container',
        'app': 'app-container'
    };
    
    const target = document.getElementById(map[screenName]);
    if (target) target.classList.remove('hidden');
}

// --- 2. GERENCIAMENTO DE PAUTAS (SELEÇÃO) ---

async function loadUserPautas() {
    const container = document.getElementById('pauta-list');
    if (!container) return;
    
    container.innerHTML = '<div class="loader mx-auto"></div>';

    try {
        // Busca pautas onde sou dono
        const qOwner = query(collection(db, "pautas"), where("owner", "==", currentUserId));
        // Busca pautas onde sou membro
        const qMember = query(collection(db, "pautas"), where("members", "array-contains", currentUserId));

        const [snapOwner, snapMember] = await Promise.all([getDocs(qOwner), getDocs(qMember)]);
        
        // Combina e remove duplicatas
        const pautasMap = new Map();
        snapOwner.forEach(d => pautasMap.set(d.id, {id: d.id, ...d.data(), role: 'Dono'}));
        snapMember.forEach(d => pautasMap.set(d.id, {id: d.id, ...d.data(), role: 'Membro'}));

        renderPautaList(Array.from(pautasMap.values()));

    } catch (error) {
        console.error("Erro ao carregar pautas:", error);
        container.innerHTML = '<p class="text-red-500 text-center">Erro ao carregar pautas.</p>';
    }
}

function renderPautaList(pautas) {
    const container = document.getElementById('pauta-list');
    container.innerHTML = '';

    if (pautas.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center">Nenhuma pauta encontrada. Crie uma nova.</p>';
        return;
    }

    pautas.forEach(pauta => {
        const div = document.createElement('div');
        div.className = "bg-white p-4 rounded-lg shadow hover:shadow-md transition cursor-pointer border-l-4 border-green-500 flex justify-between items-center";
        div.innerHTML = `
            <div>
                <h3 class="font-bold text-gray-800 text-lg">${pauta.name}</h3>
                <p class="text-sm text-gray-500">${pauta.role} • ${pauta.date || 'Sem data'}</p>
            </div>
            <button class="bg-green-100 text-green-700 px-3 py-1 rounded text-sm font-bold hover:bg-green-200">Entrar</button>
        `;
        div.addEventListener('click', () => enterPauta(pauta.id));
        container.appendChild(div);
    });
}

async function createPauta(name, date, isPublic) {
    try {
        const docRef = await addDoc(collection(db, "pautas"), {
            name: name,
            date: date,
            isPublic: isPublic,
            owner: currentUserId,
            members: [currentUserId], // Dono é membro automaticamente
            createdAt: new Date().toISOString(),
            maskNames: false // Configuração padrão
        });
        showNotification("Pauta criada com sucesso!", "success");
        loadUserPautas();
        return true;
    } catch (error) {
        console.error(error);
        showNotification("Erro ao criar pauta.", "error");
        return false;
    }
}

async function enterPauta(pautaId) {
    currentPautaId = pautaId;
    
    // Carregar dados da pauta (nome, configs)
    const docSnap = await getDoc(doc(db, "pautas", pautaId));
    if (docSnap.exists()) {
        currentPautaData = docSnap.data();
        document.getElementById('header-pauta-title').textContent = currentPautaData.name;
        showScreen('app');
        subscribeToKanban(pautaId);
    } else {
        showNotification("Pauta não encontrada.", "error");
    }
}

// --- 3. KANBAN (LÓGICA PRINCIPAL) ---

function subscribeToKanban(pautaId) {
    if (unsubscribeFromAttendances) unsubscribeFromAttendances();

    const q = collection(db, "pautas", pautaId, "attendances");
    
    unsubscribeFromAttendances = onSnapshot(q, (snapshot) => {
        allAssisted = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
        renderKanban(allAssisted);
        updateStatisticsCounters(allAssisted);
    }, (error) => {
        console.error("Erro no listener:", error);
        showNotification("Erro de conexão.", "error");
    });
}

function renderKanban(assistidos) {
    // 1. Limpar Colunas
    const cols = {
        'aguardando': document.getElementById('column-aguardando'),
        'emAtendimento': document.getElementById('column-emAtendimento'),
        'atendido': document.getElementById('column-atendido'),
        'faltoso': document.getElementById('column-faltoso')
    };

    // Verifica se elementos existem antes de limpar
    Object.values(cols).forEach(el => { if(el) el.innerHTML = ''; });
    if (!cols.aguardando) return; // Se não carregou o DOM ainda

    // 2. Ordenação Melhorada
    // Aguardando: Prioridade (URGENTE > Máxima > Média > Mínima) > Chegada
    const priorityValues = { 'URGENTE': 4, 'Máxima': 3, 'Média': 2, 'Mínima': 1 };
    
    const aguardandoList = assistidos.filter(a => a.status === 'aguardando').sort((a, b) => {
        const pA = priorityValues[a.priority] || 0;
        const pB = priorityValues[b.priority] || 0;
        if (pA !== pB) return pB - pA; // Maior prioridade primeiro
        return (a.arrivalTime || '').localeCompare(b.arrivalTime || ''); // Mais antigo primeiro
    });

    // Outros: Ordem Cronológica Reversa (Mais recentes no topo)
    const emAtendimentoList = assistidos.filter(a => a.status === 'emAtendimento').sort((a, b) => (b.inAttendanceTime || '').localeCompare(a.inAttendanceTime || ''));
    const atendidoList = assistidos.filter(a => a.status === 'atendido').sort((a, b) => (b.attendedTime || '').localeCompare(a.attendedTime || ''));
    const faltosoList = assistidos.filter(a => a.status === 'faltoso').sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

    // 3. Renderização
    renderColumn(cols.aguardando, aguardandoList);
    renderColumn(cols.emAtendimento, emAtendimentoList);
    renderColumn(cols.atendido, atendidoList);
    renderColumn(cols.faltoso, faltosoList);
}

function renderColumn(container, list) {
    if (list.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 p-4 italic text-sm">Vazio</div>';
        return;
    }

    list.forEach(item => {
        const card = createCard(item);
        container.appendChild(card);
    });
}

function createCard(item) {
    const div = document.createElement('div');
    div.id = item.id;
    div.draggable = true;
    
    // Classes de Prioridade
    let borderClass = 'border-l-4 ';
    if (item.priority === 'URGENTE') borderClass += 'border-red-500 bg-red-50';
    else if (item.priority === 'Máxima') borderClass += 'border-green-500';
    else if (item.priority === 'Média') borderClass += 'border-orange-400';
    else borderClass += 'border-gray-400';

    div.className = `bg-white p-3 rounded shadow-sm mb-2 cursor-grab active:cursor-grabbing hover:shadow-md transition relative ${borderClass}`;

    // Conteúdo do Card
    const time = formatTime(item.arrivalTime);
    const subject = item.subject || 'Sem assunto';
    
    // Botão de Deletar (Só aparece se hover)
    const deleteBtn = `<button class="delete-btn absolute top-1 right-1 text-gray-300 hover:text-red-500" onclick="handleDelete('${item.id}')">&times;</button>`;

    // Ícones e Badges
    const roomBadge = item.room ? `<span class="bg-blue-100 text-blue-800 text-xs px-1 rounded font-bold ml-1">Sala ${item.room}</span>` : '';
    const confirmIcon = item.isConfirmed ? `<span class="text-green-500 ml-1" title="Confirmado">✓</span>` : '';

    div.innerHTML = `
        ${deleteBtn}
        <div class="flex justify-between items-start mb-1">
            <span class="font-bold text-gray-800 truncate pr-4">${item.name} ${confirmIcon}</span>
            <span class="text-xs font-mono text-gray-500 bg-gray-100 px-1 rounded">${time}</span>
        </div>
        <div class="text-xs text-gray-600 mb-2 truncate">${subject} ${roomBadge}</div>
        
        <!-- Ações Rápidas -->
        <div class="flex justify-end gap-2 mt-2 border-t pt-2">
            <button class="text-blue-600 hover:bg-blue-50 p-1 rounded" title="Detalhes" onclick="handleDetails('${item.id}')">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
            </button>
            ${getCardActions(item)}
        </div>
    `;

    // Eventos de Drag & Drop
    div.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', item.id);
        div.classList.add('opacity-50');
        div.classList.add('transform', 'scale-95'); // Efeito visual
    });
    
    div.addEventListener('dragend', () => {
        div.classList.remove('opacity-50');
        div.classList.remove('transform', 'scale-95');
    });

    return div;
}

function getCardActions(item) {
    // Retorna botões diferentes dependendo do status
    if (item.status === 'aguardando') {
        return `
            <button class="text-green-600 hover:bg-green-50 p-1 rounded" title="Chamar" onclick="handleMoveToAttendance('${item.id}')">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
            </button>
        `;
    }
    if (item.status === 'emAtendimento') {
        return `
            <button class="text-purple-600 hover:bg-purple-50 p-1 rounded" title="Finalizar" onclick="handleFinish('${item.id}')">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            </button>
        `;
    }
    return '';
}

// --- 4. AÇÕES DOS CARDS (FUNÇÕES GLOBAIS) ---

// Precisamos expor essas funções para o window porque os botões são gerados como strings HTML onclick="..."
window.handleDetails = (id) => openDetailsModal({ assistedId: id, pautaId: currentPautaId, allAssisted: allAssisted });

window.handleDelete = async (id) => {
    if (confirm("Tem certeza que deseja remover este assistido?")) {
        try {
            await deleteDoc(doc(db, "pautas", currentPautaId, "attendances", id));
            showNotification("Removido.", "success");
        } catch (e) { showNotification("Erro ao remover.", "error"); }
    }
};

window.handleMoveToAttendance = async (id) => {
    // Exemplo: Pergunta a sala ou usa uma padrão
    const room = prompt("Informe a Sala (opcional):", "1");
    try {
        await updateDoc(doc(db, "pautas", currentPautaId, "attendances", id), {
            status: 'emAtendimento',
            inAttendanceTime: new Date().toISOString(),
            room: room || '',
            attendant: currentUserName
        });
    } catch (e) { showNotification("Erro ao mover.", "error"); }
};

window.handleFinish = async (id) => {
    if (confirm("Finalizar atendimento?")) {
        try {
            await updateDoc(doc(db, "pautas", currentPautaId, "attendances", id), {
                status: 'atendido',
                attendedTime: new Date().toISOString()
            });
        } catch (e) { showNotification("Erro ao finalizar.", "error"); }
    }
};

// --- 5. DRAG AND DROP LOGIC (MELHORADO) ---

const columns = document.querySelectorAll('.column-content');
columns.forEach(col => {
    col.addEventListener('dragover', e => {
        e.preventDefault();
        // Feedback visual da zona de drop
        col.classList.add('bg-green-50', 'border-dashed', 'border-2', 'border-green-300');
    });

    col.addEventListener('dragleave', () => {
        col.classList.remove('bg-green-50', 'border-dashed', 'border-2', 'border-green-300');
    });

    col.addEventListener('drop', async (e) => {
        e.preventDefault();
        // Remove estilos de feedback
        col.classList.remove('bg-green-50', 'border-dashed', 'border-2', 'border-green-300');
        
        const id = e.dataTransfer.getData('text/plain');
        const newStatus = col.dataset.status; // Certifique-se que suas divs de coluna têm data-status="aguardando", etc.
        
        if (!id || !newStatus) return;

        const updates = { status: newStatus, updatedAt: new Date().toISOString() };
        
        // Regras de negócio ao mover
        if (newStatus === 'emAtendimento') {
            updates.inAttendanceTime = new Date().toISOString();
            updates.attendant = currentUserName;
        } else if (newStatus === 'atendido') {
            updates.attendedTime = new Date().toISOString();
        } else if (newStatus === 'aguardando') {
             // Se voltar para aguardando, reseta quem estava atendendo
             updates.attendant = null;
             updates.room = null;
        }

        try {
            await updateDoc(doc(db, "pautas", currentPautaId, "attendances", id), updates);
        } catch (err) {
            console.error(err);
            showNotification("Erro ao mover.", "error");
        }
    });
});


// --- 6. FORMULÁRIOS E MODAIS (EVENT LISTENERS) ---

function setupGlobalEventListeners() {
    
    // Login
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.disabled = true; btn.textContent = "Entrando...";
        const res = await loginUser(
            document.getElementById('login-email').value,
            document.getElementById('login-password').value
        );
        btn.disabled = false; btn.textContent = "Entrar";
        if (!res.success) showNotification("Erro no login: " + res.error.message, "error");
    });

    // Cadastro
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const res = await registerUser(
            document.getElementById('reg-name').value,
            document.getElementById('reg-email').value,
            document.getElementById('reg-password').value
        );
        if (res.success) showNotification("Cadastro realizado! Aguarde aprovação.", "success");
        else showNotification("Erro: " + res.error.message, "error");
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await logoutUser();
        location.reload();
    });

    // Criar Pauta
    document.getElementById('create-pauta-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-pauta-name').value;
        const date = document.getElementById('new-pauta-date').value;
        await createPauta(name, date, true);
        document.getElementById('create-pauta-modal').classList.add('hidden');
    });

    // Adicionar Assistido
    document.getElementById('add-assisted-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentPautaId) return;
        
        const name = document.getElementById('assisted-name').value;
        const subject = document.getElementById('assisted-subject').value;
        const priority = document.getElementById('assisted-priority').value;

        try {
            await addDoc(collection(db, "pautas", currentPautaId, "attendances"), {
                name, subject, priority,
                status: 'aguardando',
                arrivalTime: new Date().toISOString(),
                isConfirmed: false
            });
            showNotification("Adicionado com sucesso!", "success");
            document.getElementById('add-assisted-modal').classList.add('hidden');
            e.target.reset();
        } catch (err) {
            showNotification("Erro ao adicionar.", "error");
        }
    });

    // Botão de Estatísticas
    document.getElementById('stats-btn')?.addEventListener('click', () => {
        if (!currentPautaId) return;
        renderStatisticsModal(allAssisted, false, currentPautaData?.name || 'Pauta');
    });

    // Botão Voltar para Pautas
    document.getElementById('back-to-pautas-btn')?.addEventListener('click', () => {
        unsubscribeFromAttendances && unsubscribeFromAttendances();
        showScreen('pauta-selection');
        loadUserPautas();
    });
    
    // Botão Notas (Anotações)
    const notesModal = document.getElementById('notes-modal');
    const notesText = document.getElementById('pauta-notes');
    
    document.getElementById('notes-btn')?.addEventListener('click', () => {
        notesText.value = localStorage.getItem(`notes_${currentPautaId}`) || "";
        notesModal.classList.remove('hidden');
    });

    document.getElementById('save-notes-btn')?.addEventListener('click', () => {
        localStorage.setItem(`notes_${currentPautaId}`, notesText.value);
        showNotification("Anotações salvas localmente.", "success");
        notesModal.classList.add('hidden');
    });

    document.getElementById('send-notes-email-btn')?.addEventListener('click', async () => {
        const content = notesText.value;
        if(!content) return showNotification("Anotação vazia.", "warning");
        if(window.emailjs) {
             try {
                 await emailjs.send("service_r1nxe6a", "template_ynrwaxt", {
                     message: content,
                     email_to: auth.currentUser.email,
                     name: currentUserName
                 });
                 showNotification("Enviado para seu email.", "success");
             } catch(e) { console.error(e); showNotification("Erro ao enviar.", "error"); }
        }
    });
    
    // Search Filter
    document.getElementById('global-search')?.addEventListener('input', (e) => {
        const term = normalizeText(e.target.value);
        if(!term) {
            renderKanban(allAssisted);
            return;
        }
        const filtered = allAssisted.filter(a => normalizeText(a.name).includes(term) || normalizeText(a.subject).includes(term));
        renderKanban(filtered);
    });

    // Setup do Autocomplete de Assuntos (Datalist)
    const datalist = document.getElementById('subject-list');
    if (datalist) {
        flatSubjects.forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub.value;
            datalist.appendChild(opt);
        });
    }
}

function updateStatisticsCounters(list) {
    // Atualiza contadores simples na tela se existirem
    const counts = {
        'count-aguardando': list.filter(a=>a.status==='aguardando').length,
        'count-atendimento': list.filter(a=>a.status==='emAtendimento').length,
        'count-atendido': list.filter(a=>a.status==='atendido').length
    };
    Object.entries(counts).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if(el) el.textContent = val;
    });
}