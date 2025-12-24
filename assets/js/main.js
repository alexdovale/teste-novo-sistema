/**
 * ARQUIVO UNIFICADO - SIGEP
 * Contém: Configuração Firebase, Autenticação, Utils, Dados, Detalhes, Estatísticas e Lógica Principal.
 */

// --- 1. IMPORTAÇÕES GERAIS DO FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    sendPasswordResetEmail,
    onAuthStateChanged,
    EmailAuthProvider,
    reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, 
    writeBatch, getDoc, setDoc, query, where, getDocs, 
    arrayUnion, arrayRemove, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- 2. CONFIGURAÇÃO E INICIALIZAÇÃO DO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyCrLwXmkxgeVoB8TwRI7pplCVQETGK0zkE",
    authDomain: "pauta-ce162.firebaseapp.com",
    projectId: "pauta-ce162",
    storageBucket: "pauta-ce162.appspot.com",
    messagingSenderId: "87113750208",
    appId: "1:87113750208:web:4abba0024f4d4af699bf25"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- 3. UTILS (Funções Auxiliares) ---
const normalizeText = (str) => {
    if (!str) return '';
    return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

const showNotification = (message, type = 'success') => {
    const colors = { 
        info: 'bg-blue-500', 
        error: 'bg-red-500', 
        success: 'bg-green-600',
        warning: 'bg-yellow-500'
    };
    const colorClass = colors[type] || colors.success;
    const notification = document.createElement('div');
    notification.className = `fixed top-5 right-5 ${colorClass} text-white py-3 px-6 rounded-lg shadow-lg z-[9999] transition-all duration-300 transform translate-x-full opacity-0 flex items-center gap-2`;
    
    let icon = '';
    if (type === 'success') icon = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
    if (type === 'error') icon = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
    
    notification.innerHTML = `${icon}<span>${message}</span>`;
    document.body.appendChild(notification);

    requestAnimationFrame(() => notification.classList.remove('translate-x-full', 'opacity-0'));
    setTimeout(() => {
        notification.classList.add('translate-x-full', 'opacity-0');
        notification.addEventListener('transitionend', () => notification.remove());
    }, 3500);
};

const formatTime = (timeStamp) => {
    if (!timeStamp) return 'N/A';
    let date;
    if (typeof timeStamp === 'object' && timeStamp !== null && 'seconds' in timeStamp) {
        date = new Date(timeStamp.seconds * 1000);
    } else {
        date = new Date(timeStamp);
    }
    if (isNaN(date.getTime()) || date.getTime() === 0) return 'N/A';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const parseCurrency = (str) => {
    if (!str) return 0;
    return parseFloat(str.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
};

const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// --- 4. ASSUNTOS (Dados) ---
const subjectTree = [
    { text: "Orientação Jurídica", description: "Esclarecimentos gerais sobre direitos." },
    { text: "Atendimento Jurídico Integral", description: "Serviço principal da Defensoria." },
    { text: "Processos Cíveis", children: [
        { text: "Ação de Obrigação de Fazer" }, { text: "Ação de Indenização" }, { text: "Revisional de Débito" }
    ]},
    { text: "Processos de Família", children: [
        { text: "Alimentos", children: [{ text: "Fixação de Alimentos" }, { text: "Majoração" }, { text: "Alimentos Gravídicos" }] },
        { text: "Divórcio", children: [{ text: "Divórcio Consensual" }, { text: "Divórcio Litigioso" }] },
        { text: "União Estável" }, { text: "Guarda" }, { text: "Investigação de Paternidade" }
    ]},
    { text: "Processos Criminais", children: [{ text: "Defesa Criminal" }, { text: "Execução Penal" }] },
    { text: "Infância e Juventude", children: [{ text: "Vaga em Escola" }] },
    { text: "Saúde / Medicamentos", children: [{ text: "Acesso a Medicamentos" }] }
];

function flattenTreeWithObjects(nodes, parentPrefix = '') {
    let flatList = [];
    nodes.forEach(node => {
        const currentValue = parentPrefix ? `${parentPrefix} > ${node.text}` : node.text;
        flatList.push({ value: currentValue, description: node.description });
        if (node.children) flatList = flatList.concat(flattenTreeWithObjects(node.children, currentValue));
    });
    return flatList;
}
const flatSubjects = flattenTreeWithObjects(subjectTree);

// --- 5. AUTH SERVICE ---
async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, error: error };
    }
}

async function registerUser(name, email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await setDoc(doc(db, "users", user.uid), {
            name: name, email: email, uid: user.uid, status: 'pending', role: 'user', createdAt: new Date().toISOString()
        });
        return { success: true, user: user };
    } catch (error) {
        return { success: false, error: error };
    }
}

async function logoutUser() {
    try { await signOut(auth); return { success: true }; } catch (error) { return { success: false, error }; }
}

function monitorAuthState(callback) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) callback(user, userDoc.data());
                else callback(user, null);
            } catch (err) { callback(user, null); }
        } else {
            callback(null, null);
        }
    });
}

// --- 6. ESTATÍSTICAS (Resumido) ---
function renderStatisticsModal(allAssisted, useDelegationFlow, pautaName) {
    const modal = document.getElementById('statistics-modal');
    if (!modal) return;
    
    // Configuração básica do modal
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    modal.classList.add('bg-white', 'p-6', 'rounded-xl', 'shadow-2xl');
    
    // Cálculos
    const atendidos = allAssisted.filter(a => a.status === 'atendido');
    const faltosos = allAssisted.filter(a => a.status === 'faltoso');
    
    // Gerar HTML Simples
    modal.innerHTML = `
        <div class="flex flex-col h-full w-full max-w-4xl mx-auto bg-white rounded-lg relative">
             <button onclick="document.getElementById('statistics-modal').classList.add('hidden')" class="absolute top-0 right-0 p-4 text-2xl text-gray-400 hover:text-red-500">&times;</button>
             <h2 class="text-2xl font-bold mb-4">Estatísticas: ${pautaName}</h2>
             
             <div class="grid grid-cols-3 gap-4 mb-6">
                <div class="bg-green-100 p-4 rounded text-center">
                    <h3 class="text-xl font-bold text-green-700">${atendidos.length}</h3>
                    <p class="text-sm">Atendidos</p>
                </div>
                <div class="bg-yellow-100 p-4 rounded text-center">
                    <h3 class="text-xl font-bold text-yellow-700">${allAssisted.length - atendidos.length - faltosos.length}</h3>
                    <p class="text-sm">Pendentes</p>
                </div>
                <div class="bg-red-100 p-4 rounded text-center">
                    <h3 class="text-xl font-bold text-red-700">${faltosos.length}</h3>
                    <p class="text-sm">Faltosos</p>
                </div>
             </div>

             <div class="flex-1 overflow-auto bg-gray-50 p-4 rounded border">
                <h3 class="font-bold mb-2">Detalhes por Assunto</h3>
                <ul class="text-sm space-y-2">
                    ${Object.entries(allAssisted.reduce((acc, a) => {
                        const subj = a.subject || 'Outros';
                        acc[subj] = (acc[subj] || 0) + 1;
                        return acc;
                    }, {})).map(([k, v]) => `<li><b>${k}:</b> ${v}</li>`).join('')}
                </ul>
             </div>
        </div>
    `;
}

// --- 7. DETALHES E CHECKLISTS ---
// Dados resumidos de documentação
const COMMON_DOCS = ['RG/CPF', 'Comprovante de Residência', 'Comprovante de Renda'];
const documentsData = {
    alimentos: { title: 'Ação de Alimentos', docs: [...COMMON_DOCS, 'Certidão de Nascimento da Criança', 'Lista de Gastos'] },
    divorcio: { title: 'Divórcio', docs: [...COMMON_DOCS, 'Certidão de Casamento', 'Lista de Bens'] },
    default: { title: 'Documentação Geral', docs: COMMON_DOCS }
};

let currentAssistedId = null;

function openDetailsModal(config) {
    const { assistedId, pautaId, allAssisted: list } = config;
    currentAssistedId = assistedId;
    currentPautaId = pautaId; // atualiza global
    
    const item = list.find(a => a.id === assistedId);
    if(!item) return;

    const modal = document.getElementById('documents-modal');
    document.getElementById('documents-assisted-name').textContent = item.name;
    
    // Renderiza checklist simples
    const container = document.getElementById('checklist-container');
    if(container) {
        container.innerHTML = `<h4 class="font-bold mb-2 text-gray-700">Checklist Rápido</h4>`;
        COMMON_DOCS.forEach(docText => {
            container.innerHTML += `
                <label class="flex items-center space-x-2 mb-2">
                    <input type="checkbox" class="rounded text-green-600"> <span>${docText}</span>
                </label>`;
        });
        
        // Botão Salvar
        const btnSave = document.getElementById('save-checklist-btn');
        if(btnSave) {
            btnSave.onclick = async () => {
                showNotification("Dados salvos localmente (Demo)", "success");
                modal.classList.add('hidden');
            };
        }
    }

    modal.classList.remove('hidden');
}

// --- 8. LÓGICA PRINCIPAL (MAIN) ---

let currentPautaId = null;
let currentPautaData = null;
let currentUserName = '';
let currentUserId = null;
let allAssisted = [];
let unsubscribeFromAttendances = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // EmailJS Init
    if (window.emailjs) emailjs.init("aGL-Q2UJcD2tDpUKq");

    // Monitoramento Auth
    monitorAuthState((user, userData) => {
        const loading = document.getElementById('loading-container');
        if(loading) loading.classList.add('hidden');

        if (user && userData) {
            currentUserId = user.uid;
            currentUserName = userData.name;
            if (userData.status === 'approved') {
                showScreen('pauta-selection');
                loadUserPautas();
                document.getElementById('current-user-display').textContent = userData.email;
            } else {
                showScreen('pending-approval');
            }
        } else {
            showScreen('login');
        }
    });
    
    setupEventListeners();
    setupDatalist();
});

function showScreen(screenName) {
    const screens = ['login-container', 'register-container', 'pending-container', 'pauta-selection-container', 'app-container'];
    screens.forEach(id => document.getElementById(id)?.classList.add('hidden'));

    const map = {
        'login': 'login-container',
        'register': 'register-container',
        'pending-approval': 'pending-container',
        'pauta-selection': 'pauta-selection-container',
        'app': 'app-container'
    };
    document.getElementById(map[screenName])?.classList.remove('hidden');
}

async function loadUserPautas() {
    const listEl = document.getElementById('pauta-list');
    listEl.innerHTML = '<div class="loader"></div>';
    
    try {
        const qOwner = query(collection(db, "pautas"), where("owner", "==", currentUserId));
        const qMember = query(collection(db, "pautas"), where("members", "array-contains", currentUserId));
        
        const [snap1, snap2] = await Promise.all([getDocs(qOwner), getDocs(qMember)]);
        const pautas = new Map();
        
        snap1.forEach(d => pautas.set(d.id, {id:d.id, ...d.data(), role:'Dono'}));
        snap2.forEach(d => pautas.set(d.id, {id:d.id, ...d.data(), role:'Membro'}));
        
        listEl.innerHTML = '';
        if(pautas.size === 0) listEl.innerHTML = '<p class="text-center text-gray-500 col-span-3">Nenhuma pauta encontrada.</p>';
        
        pautas.forEach(p => {
            const div = document.createElement('div');
            div.className = "bg-white p-6 rounded-xl shadow-md border-l-4 border-green-500 cursor-pointer hover:shadow-lg transition";
            div.innerHTML = `<h3 class="font-bold text-lg">${p.name}</h3><p class="text-sm text-gray-500">${p.date}</p>`;
            div.onclick = () => enterPauta(p.id);
            listEl.appendChild(div);
        });
    } catch(e) {
        console.error(e);
        listEl.innerHTML = '<p class="text-red-500">Erro ao carregar pautas.</p>';
    }
}

async function enterPauta(id) {
    currentPautaId = id;
    const docSnap = await getDoc(doc(db, "pautas", id));
    if(docSnap.exists()) {
        currentPautaData = docSnap.data();
        document.getElementById('header-pauta-title').textContent = currentPautaData.name;
        showScreen('app');
        subscribeKanban(id);
    }
}

function subscribeKanban(id) {
    if(unsubscribeFromAttendances) unsubscribeFromAttendances();
    const q = collection(db, "pautas", id, "attendances");
    unsubscribeFromAttendances = onSnapshot(q, (snap) => {
        allAssisted = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderKanban(allAssisted);
        updateCounters(allAssisted);
    });
}

function renderKanban(list) {
    const cols = {
        'aguardando': document.getElementById('column-aguardando'),
        'emAtendimento': document.getElementById('column-emAtendimento'),
        'atendido': document.getElementById('column-atendido'),
        'faltoso': document.getElementById('column-faltoso')
    };
    
    // Limpar
    Object.values(cols).forEach(c => { if(c) c.innerHTML = ''; });
    if(!cols.aguardando) return;

    list.forEach(item => {
        const card = createCard(item);
        if(cols[item.status]) cols[item.status].appendChild(card);
    });
}

function createCard(item) {
    const div = document.createElement('div');
    div.id = item.id;
    div.draggable = true;
    div.className = "bg-white p-3 rounded shadow mb-2 border-l-4 " + (item.priority === 'URGENTE' ? 'border-red-500' : 'border-green-500') + " cursor-grab active:cursor-grabbing hover:shadow-md transition relative group";
    
    div.innerHTML = `
        <div class="flex justify-between">
            <span class="font-bold truncate pr-2">${item.name}</span>
            <span class="text-xs bg-gray-100 px-1 rounded">${formatTime(item.arrivalTime || item.createdAt)}</span>
        </div>
        <div class="text-xs text-gray-500 truncate">${item.subject || 'Sem assunto'}</div>
        <div class="mt-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
             <button class="text-blue-500 hover:text-blue-700 text-xs" onclick="window.handleDetails('${item.id}')">Detalhes</button>
             ${item.status === 'aguardando' ? `<button class="text-green-600 text-xs font-bold" onclick="window.moveTo('${item.id}', 'emAtendimento')">Chamar</button>` : ''}
             ${item.status === 'emAtendimento' ? `<button class="text-purple-600 text-xs font-bold" onclick="window.moveTo('${item.id}', 'atendido')">Finalizar</button>` : ''}
        </div>
    `;

    div.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', item.id);
        div.classList.add('opacity-50');
    };
    div.ondragend = () => div.classList.remove('opacity-50');

    return div;
}

// Funções Globais para o HTML acessar
window.handleDetails = (id) => openDetailsModal({ assistedId: id, pautaId: currentPautaId, allAssisted });
window.moveTo = async (id, status) => {
    try {
        await updateDoc(doc(db, "pautas", currentPautaId, "attendances", id), {
            status: status,
            updatedAt: new Date().toISOString(),
            attendant: currentUserName
        });
    } catch(e) { showNotification("Erro ao mover.", "error"); }
};

function setupEventListeners() {
    // Login
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const res = await loginUser(document.getElementById('login-email').value, document.getElementById('login-password').value);
        if(!res.success) showNotification("Erro Login: " + res.error.message, "error");
    });

    // Cadastro
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const res = await registerUser(document.getElementById('reg-name').value, document.getElementById('reg-email').value, document.getElementById('reg-password').value);
        if(res.success) showNotification("Conta criada! Aguarde aprovação.", "success");
        else showNotification("Erro Cadastro: " + res.error.message, "error");
    });
    
    // Navegação Auth
    document.getElementById('show-register-link')?.addEventListener('click', () => showScreen('register'));
    document.getElementById('back-to-login-link')?.addEventListener('click', () => showScreen('login'));
    document.getElementById('logout-selection-btn')?.addEventListener('click', () => { signOut(auth); location.reload(); });

    // Nova Pauta
    document.getElementById('create-new-pauta-btn')?.addEventListener('click', () => document.getElementById('create-pauta-modal').classList.remove('hidden'));
    document.getElementById('create-pauta-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-pauta-name').value;
        const date = document.getElementById('new-pauta-date').value;
        try {
            await addDoc(collection(db, "pautas"), {
                name, date, owner: currentUserId, members: [currentUserId], createdAt: new Date().toISOString()
            });
            document.getElementById('create-pauta-modal').classList.add('hidden');
            loadUserPautas();
            showNotification("Pauta criada!", "success");
        } catch(e) { showNotification("Erro ao criar pauta.", "error"); }
    });

    // Adicionar Assistido
    document.getElementById('add-assisted-btn')?.addEventListener('click', () => document.getElementById('add-assisted-modal').classList.remove('hidden'));
    document.getElementById('add-assisted-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!currentPautaId) return;
        try {
            await addDoc(collection(db, "pautas", currentPautaId, "attendances"), {
                name: document.getElementById('assisted-name').value,
                subject: document.getElementById('assisted-subject').value,
                priority: document.getElementById('assisted-priority').value,
                status: 'aguardando',
                createdAt: serverTimestamp(),
                arrivalTime: new Date().toISOString()
            });
            document.getElementById('add-assisted-modal').classList.add('hidden');
            e.target.reset();
            showNotification("Adicionado!", "success");
        } catch(e) { showNotification("Erro ao adicionar.", "error"); }
    });

    // Voltar
    document.getElementById('back-to-pautas-btn')?.addEventListener('click', () => {
        if(unsubscribeFromAttendances) unsubscribeFromAttendances();
        showScreen('pauta-selection');
    });

    // Estatísticas
    document.getElementById('stats-btn')?.addEventListener('click', () => renderStatisticsModal(allAssisted, false, currentPautaData.name));
    
    // Drag & Drop nas Colunas
    document.querySelectorAll('.column-content').forEach(col => {
        col.ondragover = e => { e.preventDefault(); col.classList.add('bg-gray-200'); };
        col.ondragleave = () => col.classList.remove('bg-gray-200');
        col.ondrop = (e) => {
            col.classList.remove('bg-gray-200');
            const id = e.dataTransfer.getData('text/plain');
            window.moveTo(id, col.dataset.status);
        };
    });
    
    // Fechar Modais (Botões X)
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.onclick = () => btn.closest('.fixed').classList.add('hidden');
    });
}

function updateCounters(list) {
    document.getElementById('count-aguardando').innerText = list.filter(a=>a.status==='aguardando').length;
    document.getElementById('count-atendimento').innerText = list.filter(a=>a.status==='emAtendimento').length;
    document.getElementById('count-atendido').innerText = list.filter(a=>a.status==='atendido').length;
}

function setupDatalist() {
    const dl = document.getElementById('subject-list');
    if(dl && flatSubjects) {
        flatSubjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.value;
            dl.appendChild(opt);
        });
    }
}
