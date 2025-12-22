// src/lib/queueDistribution.js
import { collection, query, where, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Busca o próximo atendente disponível para receber um chamado
 * Lógica: Round-robin baseado no número de chamados atribuídos
 */
export async function getNextAttendant() {
    try {
        // Buscar todos os atendentes
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', 'atendente'));
        const snapshot = await getDocs(q);

        const attendants = snapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data(),
        }));

        // Filtrar apenas atendentes online
        const onlineAttendants = attendants.filter(a => a.isOnline === true);

        if (onlineAttendants.length === 0) {
            console.log('Nenhum atendente online disponível');
            return null;
        }

        // Se só tem 1 atendente online, retorna ele
        if (onlineAttendants.length === 1) {
            return onlineAttendants[0];
        }

        // Distribuição intercalada: atendente com menos chamados atribuídos
        const sortedAttendants = onlineAttendants.sort((a, b) => {
            const aCount = a.ticketsAssigned || 0;
            const bCount = b.ticketsAssigned || 0;
            return aCount - bCount;
        });

        return sortedAttendants[0];
    } catch (error) {
        console.error('Erro ao buscar próximo atendente:', error);
        return null;
    }
}

/**
 * Busca todos os atendentes (online e offline) para transferência
 */
export async function getAllAttendants() {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', 'atendente'));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data(),
        }));
    } catch (error) {
        console.error('Erro ao buscar atendentes:', error);
        return [];
    }
}

/**
 * Busca chamados órfãos (sem atendente atribuído) e distribui para atendentes online
 */
export async function redistributeOrphanTickets() {
    try {
        // Buscar chamados órfãos (status = queue e sem assignedTo)
        const ticketsRef = collection(db, 'tickets');
        const q = query(
            ticketsRef,
            where('status', '==', 'queue'),
            where('assignedTo', '==', null)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log('Nenhum chamado órfão encontrado');
            return 0;
        }

        let redistributedCount = 0;

        // Para cada chamado órfão, tentar atribuir
        for (const ticketDoc of snapshot.docs) {
            const attendant = await getNextAttendant();

            if (attendant) {
                await assignTicketToAttendant(ticketDoc.id, attendant);
                redistributedCount++;
                console.log(`Chamado ${ticketDoc.id} redistribuído para ${attendant.name}`);
            } else {
                console.log('Nenhum atendente online para redistribuir');
                break; // Se não tem atendente, para de tentar
            }
        }

        return redistributedCount;
    } catch (error) {
        console.error('Erro ao redistribuir chamados órfãos:', error);
        return 0;
    }
}

/**
 * Atribui um chamado a um atendente
 */
export async function assignTicketToAttendant(ticketId, attendant) {
    try {
        const ticketRef = doc(db, 'tickets', ticketId);
        const userRef = doc(db, 'users', attendant.uid);

        // Atualizar ticket com informações do atendente
        await updateDoc(ticketRef, {
            assignedTo: {
                uid: attendant.uid,
                name: attendant.name,
                email: attendant.email,
                assignedAt: new Date(),
                startedAt: null,
            },
            status: 'queue', // Mantém em fila até atendente clicar em "Atender"
        });

        // Incrementar contador de chamados do atendente
        await updateDoc(userRef, {
            ticketsAssigned: increment(1),
        });

        return true;
    } catch (error) {
        console.error('Erro ao atribuir chamado:', error);
        return false;
    }
}

/**
 * Transfere um chamado para outro atendente
 */
export async function transferTicket(ticketId, currentAttendantUid, newAttendant) {
    try {
        const ticketRef = doc(db, 'tickets', ticketId);
        const currentUserRef = doc(db, 'users', currentAttendantUid);
        const newUserRef = doc(db, 'users', newAttendant.uid);

        // Atualizar ticket com novo atendente
        await updateDoc(ticketRef, {
            assignedTo: {
                uid: newAttendant.uid,
                name: newAttendant.name,
                email: newAttendant.email,
                assignedAt: new Date(),
                startedAt: null,
            },
            transferredFrom: currentAttendantUid,
            transferredAt: new Date(),
        });

        // Decrementar contador do atendente atual
        await updateDoc(currentUserRef, {
            ticketsAssigned: increment(-1),
        });

        // Incrementar contador do novo atendente
        await updateDoc(newUserRef, {
            ticketsAssigned: increment(1),
        });

        return true;
    } catch (error) {
        console.error('Erro ao transferir chamado:', error);
        return false;
    }
}

/**
 * Inicia atendimento de um chamado
 */
export async function startTicket(ticketId, attendantUid) {
    try {
        const ticketRef = doc(db, 'tickets', ticketId);

        await updateDoc(ticketRef, {
            'assignedTo.startedAt': new Date(),
            status: 'started',
            // Registrar tempo de início para cálculo posterior
            timeStarted: new Date(),
        });

        return true;
    } catch (error) {
        console.error('Erro ao iniciar chamado:', error);
        return false;
    }
}

/**
 * Atualiza status do chamado
 */
export async function updateTicketStatus(ticketId, newStatus, message = null) {
    try {
        const ticketRef = doc(db, 'tickets', ticketId);

        const updateData = {
            status: newStatus,
            updatedAt: new Date(),
        };

        // Se houver mensagem (para solicitar info ou resolução)
        if (message) {
            updateData.statusMessage = message;
        }

        // Se está resolvendo, registrar tempo de resolução
        if (newStatus === 'resolved') {
            updateData.timeResolved = new Date();
        }

        await updateDoc(ticketRef, updateData);

        return true;
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        return false;
    }
}

/**
 * Libera chamado quando cancelado (decrementa contador do atendente)
 */
export async function releaseTicketFromAttendant(attendantUid) {
    try {
        if (!attendantUid) return;

        const userRef = doc(db, 'users', attendantUid);
        await updateDoc(userRef, {
            ticketsAssigned: increment(-1),
        });

        return true;
    } catch (error) {
        console.error('Erro ao liberar chamado:', error);
        return false;
    }
}
