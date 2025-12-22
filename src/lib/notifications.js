// src/lib/notifications.js
'use client';

// Função para solicitar permissão de notificações
export async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Este navegador não suporta notificações');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    return false;
}

// Função para mostrar notificação no navegador
export function showBrowserNotification(title, options = {}) {
    if (Notification.permission === 'granted') {
        const notification = new Notification(title, {
            icon: '/favicon.png',
            badge: '/favicon.png',
            ...options,
        });

        // Tocar som (opcional)
        if (options.playSound) {
            playNotificationSound();
        }

        // Fechar automaticamente após 5 segundos
        setTimeout(() => notification.close(), 5000);

        return notification;
    }
}

// Função para tocar som de notificação
function playNotificationSound() {
    try {
        const audio = new Audio('/notification-sound.mp3');
        audio.volume = 0.5;
        audio.play().catch(err => console.log('Erro ao tocar som:', err));
    } catch (error) {
        console.log('Som de notificação não disponível');
    }
}

// Função para enviar email via API
export async function sendEmailNotification(data) {
    try {
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error('Erro ao enviar email');
        }

        return await response.json();
    } catch (error) {
        console.error('Erro ao enviar notificação por email:', error);
        throw error;
    }
}

// Função helper para notificar atribuição de chamado
export async function notifyTicketAssigned(ticket, attendant) {
    // Email
    await sendEmailNotification({
        to: attendant.email,
        subject: `Novo chamado atribuído - #${ticket.id}`,
        type: 'ticket_assigned',
        ticketData: {
            ticketId: ticket.id,
            ticketSubject: ticket.subject,
            attendantName: attendant.name,
            collaboratorName: ticket.createdBy.name,
            priority: ticket.priority,
            department: ticket.department,
        },
    });

    // Notificação no navegador (se o atendente estiver online)
    showBrowserNotification('Novo Chamado Atribuído', {
        body: `${ticket.subject} - ${ticket.createdBy.name}`,
        tag: `ticket-${ticket.id}`,
        playSound: true,
    });
}

// Função helper para notificar início de atendimento
export async function notifyTicketStarted(ticket, attendant, collaborator) {
    await sendEmailNotification({
        to: collaborator.email,
        subject: `Seu chamado foi iniciado - #${ticket.id}`,
        type: 'ticket_started',
        ticketData: {
            ticketId: ticket.id,
            ticketSubject: ticket.subject,
            attendantName: attendant.name,
            collaboratorName: collaborator.name,
        },
    });

    showBrowserNotification('Chamado Iniciado', {
        body: `${attendant.name} iniciou o atendimento do seu chamado`,
        tag: `ticket-${ticket.id}`,
    });
}

// Função helper para notificar mudança de status
export async function notifyStatusChange(ticket, newStatus, attendant, collaborator, message) {
    const statusMessages = {
        analyzing: 'Em Análise',
        waiting_user: 'Aguardando Retorno',
        resolved: 'Resolvido',
    };

    const typeMap = {
        analyzing: 'status_analyzing',
        waiting_user: 'request_info',
        resolved: 'ticket_resolved',
    };

    await sendEmailNotification({
        to: collaborator.email,
        subject: `Atualização do chamado - #${ticket.id}`,
        type: typeMap[newStatus],
        ticketData: {
            ticketId: ticket.id,
            ticketSubject: ticket.subject,
            attendantName: attendant.name,
            collaboratorName: collaborator.name,
            requestMessage: message,
            resolutionMessage: message,
        },
    });

    showBrowserNotification(`Chamado ${statusMessages[newStatus]}`, {
        body: ticket.subject,
        tag: `ticket-${ticket.id}`,
    });
}

// Função helper para notificar atendente quando colaborador responde
export async function notifyCollaboratorResponse(ticket, collaborator, attendant, responseMessage) {
    await sendEmailNotification({
        to: attendant.email,
        subject: `Colaborador respondeu - #${ticket.id}`,
        type: 'collaborator_response',
        ticketData: {
            ticketId: ticket.id,
            ticketSubject: ticket.subject,
            attendantName: attendant.name,
            collaboratorName: collaborator.name,
            responseMessage: responseMessage,
        },
    });

    showBrowserNotification('Colaborador Respondeu', {
        body: `${collaborator.name} respondeu à sua solicitação`,
        tag: `ticket-${ticket.id}`,
    });
}

// Função helper para notificar cancelamento
export async function notifyTicketCanceled(ticket, attendant) {
    if (attendant) {
        await sendEmailNotification({
            to: attendant.email,
            subject: `Chamado cancelado - #${ticket.id}`,
            type: 'ticket_canceled',
            ticketData: {
                ticketId: ticket.id,
                ticketSubject: ticket.subject,
                attendantName: attendant.name,
                collaboratorName: ticket.createdBy.name,
            },
        });

        showBrowserNotification('Chamado Cancelado', {
            body: `${ticket.subject} foi cancelado por ${ticket.createdBy.name}`,
            tag: `ticket-${ticket.id}`,
        });
    }
}

