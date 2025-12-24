// assets/js/auth-service.js
import { auth, db } from './firebase-init.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    sendPasswordResetEmail,
    onAuthStateChanged,
    EmailAuthProvider,
    reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/**
 * Realiza o login do usuário.
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{success: boolean, user?: object, error?: any}>}
 */
export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error("Erro no login:", error);
        return { success: false, error: error };
    }
}

/**
 * Registra um novo usuário e cria seu documento no Firestore.
 * @param {string} name 
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{success: boolean, user?: object, error?: any}>}
 */
export async function registerUser(name, email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Cria o documento do usuário no Firestore
        // Definimos 'role: user' e 'status: pending' por segurança padrão
        await setDoc(doc(db, "users", user.uid), {
            name: name,
            email: email,
            uid: user.uid,
            status: 'pending', // Requer aprovação (ou mude para 'approved' se quiser liberar direto)
            role: 'user',      
            createdAt: new Date().toISOString()
        });

        return { success: true, user: user };
    } catch (error) {
        console.error("Erro no registro:", error);
        return { success: false, error: error };
    }
}

/**
 * Desloga o usuário atual.
 */
export async function logoutUser() {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        console.error("Erro no logout:", error);
        return { success: false, error: error };
    }
}

/**
 * Envia email de recuperação de senha.
 * @param {string} email 
 */
export async function recoverPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true };
    } catch (error) {
        console.error("Erro ao recuperar senha:", error);
        return { success: false, error: error };
    }
}

/**
 * Reautentica o usuário (Necessário para operações sensíveis como fechar/zerar pauta).
 * @param {string} password 
 */
export async function reauthenticateUser(password) {
    const user = auth.currentUser;
    if (!user) return { success: false, error: "Usuário não autenticado." };
    
    try {
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
        return { success: true };
    } catch (error) {
        console.error("Erro na reautenticação:", error);
        return { success: false, error: error };
    }
}

/**
 * Monitora o estado da autenticação em tempo real.
 * Retorna o usuário do Auth E os dados do Firestore (perfil).
 * @param {function} callback 
 */
export function monitorAuthState(callback) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Se logado, busca os dados extras no Firestore (nome, status, role)
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    callback(user, userDoc.data());
                } else {
                    // Caso raro onde o usuário existe no Auth mas não no Firestore
                    callback(user, null);
                }
            } catch (err) {
                console.error("Erro ao buscar dados do usuário:", err);
                callback(user, null);
            }
        } else {
            callback(null, null);
        }
    });
}