// src/app/api/notify-ticket/route.js
import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { type, ticket, user, previousStatus, comment } = await request.json();

    console.log('📧 [EMAIL API] Recebida requisição de notificação');
    console.log('📧 [EMAIL API] Tipo:', type);
    console.log('📧 [EMAIL API] Ticket ID:', ticket?.id);
    console.log('📧 [EMAIL API] User:', user?.name, user?.role);

    if (!type || !ticket) {
      console.error('❌ [EMAIL API] Erro: Tipo ou ticket ausente');
      return NextResponse.json(
        { error: 'Tipo e dados do ticket são obrigatórios' },
        { status: 400 }
      );
    }

    const supportEmail = 'suporte@tecassistiva.com.br';
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Helpdesk Tecassistiva <onboarding@resend.dev>';

    console.log('📧 [EMAIL API] From Email:', fromEmail);
    console.log('📧 [EMAIL API] Resend API Key exists:', !!process.env.RESEND_API_KEY);

    let subject = '';
    let emailHtml = '';

    const statusLabels = {
      queue: 'Em Fila',
      started: 'Iniciado',
      analyzing: 'Em Análise',
      waiting_user: 'Aguardando Retorno',
      resolved: 'Resolvido',
      canceled: 'Cancelado'
    };

    const priorityLabels = {
      low: 'Baixa',
      medium: 'Média',
      high: 'Alta',
      urgent: 'Urgente'
    };

    // Template base do email
    const baseTemplate = (title, content) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #002554; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Helpdesk Tecassistiva</h1>
        </div>
        
        <div style="padding: 30px; background: #f9fafb;">
          <h2 style="color: #002554; margin-top: 0;">${title}</h2>
          ${content}
        </div>
        
        <div style="background: #e5e7eb; padding: 20px; text-align: center;">
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Helpdesk Tecassistiva - TecAssistiva
          </p>
        </div>
      </div>
    `;

    // Informações do ticket
    const ticketInfo = `
      <div style="background: white; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>ID do Chamado:</strong> ${ticket.id}</p>
        <p style="margin: 5px 0;"><strong>Assunto:</strong> ${ticket.subject}</p>
        <p style="margin: 5px 0;"><strong>Solicitante:</strong> ${ticket.createdBy?.name || 'N/A'} (${ticket.createdBy?.email || 'N/A'})</p>
        <p style="margin: 5px 0;"><strong>Prioridade:</strong> ${priorityLabels[ticket.priority] || ticket.priority}</p>
        <p style="margin: 5px 0;"><strong>Status Atual:</strong> ${statusLabels[ticket.status] || ticket.status}</p>
        <p style="margin: 5px 0;"><strong>Atendente:</strong> ${ticket.assignedTo?.name || 'Não atribuído'}</p>
      </div>
    `;

    switch (type) {
      case 'new':
        subject = `🆕 Novo Chamado: ${ticket.subject}`;
        emailHtml = baseTemplate('Novo Chamado Criado', `
          <p style="color: #374151; font-size: 16px;">
            Um novo chamado foi criado no sistema.
          </p>
          ${ticketInfo}
          <div style="background: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0;"><strong>Descrição:</strong></p>
            <p style="margin: 10px 0 0 0;">${ticket.description || 'Sem descrição'}</p>
          </div>
        `);
        break;

      case 'status_change':
        subject = `🔄 Status Alterado: ${ticket.subject}`;
        emailHtml = baseTemplate('Status do Chamado Alterado', `
          <p style="color: #374151; font-size: 16px;">
            O status do chamado foi alterado.
          </p>
          ${ticketInfo}
          <div style="background: #dbeafe; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6;">
            <p style="margin: 0;">
              <strong>Alteração:</strong> ${statusLabels[previousStatus] || previousStatus} → ${statusLabels[ticket.status] || ticket.status}
            </p>
            ${user ? `<p style="margin: 10px 0 0 0;"><strong>Alterado por:</strong> ${user.name}</p>` : ''}
          </div>
        `);
        break;

      case 'comment':
        subject = `💬 Novo Comentário: ${ticket.subject}`;
        emailHtml = baseTemplate('Novo Comentário Adicionado', `
          <p style="color: #374151; font-size: 16px;">
            Um novo comentário foi adicionado ao chamado.
          </p>
          ${ticketInfo}
          <div style="background: #f3e8ff; padding: 15px; border-radius: 6px; border-left: 4px solid #a855f7;">
            <p style="margin: 0;"><strong>Comentário de:</strong> ${comment?.author?.name || user?.name || 'N/A'}</p>
            <p style="margin: 10px 0 0 0;">${comment?.text || 'Sem texto'}</p>
          </div>
        `);
        break;

      case 'assigned':
        const attendantName = ticket.assignedTo?.name || 'Um atendente';
        subject = `👤 Atendimento Iniciado: ${ticket.subject}`;
        emailHtml = baseTemplate('Atendimento Iniciado', `
          <p style="color: #374151; font-size: 16px;">
            O atendente <strong>${attendantName}</strong> iniciou o atendimento do seu chamado.
          </p>
          ${ticketInfo}
          <div style="background: #dcfce7; padding: 15px; border-radius: 6px; border-left: 4px solid #22c55e;">
            <p style="margin: 0;">
              <strong>Status:</strong> Em atendimento
            </p>
          </div>
        `);
        break;

      case 'resolved':
        subject = `✅ Chamado Concluído: ${ticket.subject}`;
        const resolutionTime = ticket.timeStarted && ticket.timeResolved
          ? calculateResolutionTime(ticket.timeStarted, ticket.timeResolved)
          : 'N/A';

        emailHtml = baseTemplate('Chamado Concluído', `
          <p style="color: #374151; font-size: 16px;">
            O chamado foi concluído.
          </p>
          ${ticketInfo}
          <div style="background: #dcfce7; padding: 15px; border-radius: 6px; border-left: 4px solid #22c55e;">
            <p style="margin: 0;"><strong>Tempo de Resolução:</strong> ${resolutionTime}</p>
            <p style="margin: 10px 0 0 0;"><strong>Concluído por:</strong> ${ticket.assignedTo?.name || 'N/A'}</p>
          </div>
        `);
        break;

      default:
        return NextResponse.json(
          { error: 'Tipo de notificação inválido' },
          { status: 400 }
        );
    }

    // Determinar destinatário baseado no tipo de ação e papel do usuário
    let recipientEmail = supportEmail;

    // Ações do ATENDENTE/ADMIN → Email para COLABORADOR
    if (user && (user.role === 'atendente' || user.role === 'admin')) {
      if (type === 'assigned' || type === 'status_change' || type === 'resolved') {
        // Atendente iniciou, mudou status ou resolveu → Email para colaborador
        recipientEmail = ticket.createdBy?.email || supportEmail;
      }
    }

    // Ações do COLABORADOR → Email para SUPORTE
    if (user && user.role === 'colaborador') {
      if (type === 'comment' || type === 'new') {
        // Colaborador comentou ou criou chamado → Email para suporte
        recipientEmail = supportEmail;
      }
      if (type === 'status_change' && ticket.status === 'analyzing') {
        // Colaborador reabriu → Email para suporte
        recipientEmail = supportEmail;
      }
    }

    // Novo chamado SEMPRE vai para suporte
    if (type === 'new') {
      recipientEmail = supportEmail;
    }

    console.log('📧 [EMAIL API] Destinatário determinado:', recipientEmail);
    console.log('📧 [EMAIL API] Assunto:', subject);
    console.log('📧 [EMAIL API] Tentando enviar email...');

    const data = await resend.emails.send({
      from: fromEmail,
      to: [recipientEmail],
      subject: subject,
      html: emailHtml,
    });

    console.log('✅ [EMAIL API] Email enviado com sucesso!');
    console.log('✅ [EMAIL API] ID:', data.id);
    console.log('✅ [EMAIL API] Enviado para:', recipientEmail);

    return NextResponse.json({ success: true, id: data.id, sentTo: recipientEmail });
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar notificação', details: error.message },
      { status: 500 }
    );
  }
}

function calculateResolutionTime(startTime, endTime) {
  try {
    const start = startTime.toDate ? startTime.toDate() : new Date(startTime);
    const end = endTime.toDate ? endTime.toDate() : new Date(endTime);
    const hours = (end - start) / (1000 * 60 * 60);

    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
    } else if (hours < 24) {
      return `${hours.toFixed(1)} hora${hours >= 2 ? 's' : ''}`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.round(hours % 24);
      return `${days} dia${days !== 1 ? 's' : ''} e ${remainingHours} hora${remainingHours !== 1 ? 's' : ''}`;
    }
  } catch (error) {
    return 'N/A';
  }
}
