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
    const financeEmail = 'administrativo1@tecassistiva.com.br';
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Helpdesk Tecassistiva <noreply@site.tecassistiva.com.br>';

    console.log('📧 [EMAIL API] From Email:', fromEmail);
    console.log('📧 [EMAIL API] Resend API Key exists:', !!process.env.RESEND_API_KEY);

    let subject = '';
    let emailHtml = '';

    const statusLabels = {
      queue: 'Em Fila',
      started: 'Iniciado',
      analyzing: 'Em Análise',
      waiting_user: 'Aguardando Retorno',
      waiting_nf: 'Aguardando Emissão de NF',
      nf_emitted: 'NF Emitida',
      resolved: 'Resolvido',
      canceled: 'Cancelado'
    };

    const priorityLabels = {
      low: 'Baixa',
      medium: 'Média',
      high: 'Alta',
      urgent: 'Urgente'
    };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://helpdesk.tecassistiva.com.br';

    // Template base do email
    const baseTemplate = (title, content, actionText = 'Acessar Helpdesk') => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #002554; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Helpdesk Tecassistiva</h1>
        </div>
        
        <div style="padding: 30px; background: #f9fafb;">
          <h2 style="color: #002554; margin-top: 0;">${title}</h2>
          ${content}
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${appUrl}" style="background-color: #002554; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
              ${actionText}
            </a>
          </div>
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
        <p style="margin: 5px 0;"><strong>Categoria:</strong> ${ticket.categoryName || 'N/A'}</p>
        <p style="margin: 5px 0;"><strong>Solicitante:</strong> ${ticket.createdBy?.name || 'N/A'} (${ticket.createdBy?.email || 'N/A'})</p>
        <p style="margin: 5px 0;"><strong>Prioridade:</strong> ${priorityLabels[ticket.priority] || ticket.priority}</p>
        <p style="margin: 5px 0;"><strong>Status Atual:</strong> ${statusLabels[ticket.status] || ticket.status}</p>
        <p style="margin: 5px 0;"><strong>Atendente:</strong> ${ticket.assignedTo?.name || 'Não atribuído'}</p>
      </div>
    `;

    switch (type) {
      case 'new':
        subject = `🆕 Novo Chamado: [${ticket.categoryName || 'Geral'}] ${ticket.subject}`;
        emailHtml = baseTemplate('Novo Chamado Criado', `
          <p style="color: #374151; font-size: 16px;">
            Um novo chamado foi criado no sistema.
          </p>
          ${ticketInfo}
          <div style="background: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0;"><strong>Descrição:</strong></p>
            <p style="margin: 10px 0 0 0;">${ticket.description || 'Sem descrição'}</p>
          </div>
        `, 'Acessar Chamado');
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
        `, 'Ver Alterações');
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
        `, 'Responder Comentário');
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
        `, 'Acompanhar Chamado');
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
        `, 'Verificar Solução');
        break;

      case 'nf_request':
        subject = `📄 Solicitação de Emissão de NF: ${ticket.subject}`;
        emailHtml = baseTemplate('Solicitação de Nota Fiscal', `
          <p style="color: #374151; font-size: 16px;">
            Foi solicitada a emissão de Nota Fiscal para o chamado abaixo.
          </p>
          ${ticketInfo}
          <div style="background: #fce7f3; padding: 15px; border-radius: 6px; border-left: 4px solid #db2777;">
            <p style="margin: 0;"><strong>Ação Necessária:</strong></p>
            <p style="margin: 10px 0 0 0;">Verifique os dados dos produtos e emita a NF. Após a emissão, finalize o chamado no sistema.</p>
          </div>
        `, 'Acessar para Emitir NF');
        break;
      case 'nf_reminder':
        subject = `⚠️ ALERTA: Prazo da Nota Fiscal acabando em 10 dias! (${ticket.subject})`;
        const reminderDeadline = ticket.nfReturnDeadline 
          ? new Date(ticket.nfReturnDeadline).toLocaleDateString('pt-BR')
          : 'N/A';
        emailHtml = baseTemplate('Prazo de NF Vencendo!', `
          <p style="color: #b91c1c; font-size: 16px; font-weight: bold;">
            Atenção! Faltam apenas 10 dias para o fim do prazo de devolução dos equipamentos.
          </p>
          ${ticketInfo}
          <div style="background: #fef2f2; padding: 15px; border-radius: 6px; border-left: 4px solid #dc2626;">
            <p style="margin: 0; color: #991b1b;"><strong>Dados da Nota Fiscal:</strong></p>
            <p style="margin: 5px 0 0 0; color: #991b1b;"><strong>Número:</strong> ${ticket.nfNumber || 'N/A'}</p>
            <p style="margin: 5px 0 0 0; color: #991b1b;"><strong>Prazo Limite:</strong> ${reminderDeadline}</p>
            <p style="margin: 10px 0 0 0;">Por favor, providencie o retorno dos equipamentos o mais rápido possível e registre a devolução no sistema.</p>
          </div>
        `, 'Acessar Chamado');
        break;

      case 'nf_emitted':
        subject = `🧾 Nota Fiscal Emitida: ${ticket.subject}`;
        const returnDate = ticket.nfReturnDeadline
          ? new Date(ticket.nfReturnDeadline).toLocaleDateString('pt-BR')
          : 'N/A';

        emailHtml = baseTemplate('Nota Fiscal Emitida', `
          <p style="color: #374151; font-size: 16px;">
            A Nota Fiscal foi emitida e seus equipamentos estão liberados para viagem.
          </p>
          ${ticketInfo}
          <div style="background: #e0e7ff; padding: 15px; border-radius: 6px; border-left: 4px solid #4f46e5;">
            <p style="margin: 0;"><strong>Dados da Emissão:</strong></p>
            <p style="margin: 5px 0;"><strong>NF Número:</strong> ${ticket.nfNumber}</p>
            <p style="margin: 5px 0 0 0;"><strong>Prazo Limite para Retorno:</strong> ${returnDate}</p>
          </div>
          <p style="margin-top: 15px; font-size: 14px; color: #6b7280;">
             Fique atento ao prazo de retorno (90 dias) para evitar problemas fiscais.
          </p>
        `, 'Acompanhar Chamado');
        break;

      case 'nf_returned':
        subject = `↩️ NF Devolvida / Chamado Resolvido: ${ticket.subject}`;
        const returnDateVal = new Date().toLocaleDateString('pt-BR');

        emailHtml = baseTemplate('Nota Fiscal Devolvida', `
          <p style="color: #374151; font-size: 16px;">
            A devolução da Nota Fiscal foi registrada e o chamado foi concluído.
          </p>
          ${ticketInfo}
           <div style="background: #e0e7ff; padding: 15px; border-radius: 6px; border-left: 4px solid #4f46e5;">
            <p style="margin: 0;"><strong>Registro de Retorno:</strong></p>
            <p style="margin: 5px 0;"><strong>NF Número:</strong> ${ticket.nfNumber}</p>
            <p style="margin: 5px 0 0 0;"><strong>Devolvida em:</strong> ${returnDateVal}</p>
          </div>
        `, 'Verificar Chamado');
        break;

      default:
        return NextResponse.json(
          { error: 'Tipo de notificação inválido' },
          { status: 400 }
        );
    }

    // Determinar destinatário baseado no tipo de ação e papel do usuário
    let recipientEmail = supportEmail;

    console.log('🔍 [EMAIL API LOGIC] User Role:', user?.role);
    console.log('🔍 [EMAIL API LOGIC] Action Type:', type);
    console.log('🔍 [EMAIL API LOGIC] Ticket CreatedBy Email:', ticket.createdBy?.email);

    // Ações do ATENDENTE/ADMIN → Email para COLABORADOR
    if (user && (user.role === 'atendente' || user.role === 'admin')) {
      if (type === 'assigned' || type === 'status_change' || type === 'resolved') {
        // Atendente iniciou, mudou status ou resolveu → Email para colaborador
        recipientEmail = ticket.createdBy?.email || supportEmail;
        console.log('🔍 [EMAIL API LOGIC] >> REGRA APLICADA: Atendente/Admin -> Colaborador');
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

    // Solicitação de NF SEMPRE vai para financeiro
    if (type === 'nf_request') {
      recipientEmail = financeEmail;
    }

    // NF Emitida vai para o COLABORADOR
    if (type === 'nf_emitted') {
      recipientEmail = ticket.createdBy?.email || supportEmail;
    }

    // NF Devolvida vai APENAS para FINANCEIRO (Confirmação interna)
    if (type === 'nf_returned') {
      recipientEmail = financeEmail;
    }

    // NF Reminder (Aviso de 10 dias) vai para o criador do chamado (colaborador)
    if (type === 'nf_reminder') {
      recipientEmail = ticket.createdBy?.email || financeEmail;
    }

    console.log('📧 [EMAIL API] Destinatário determinado:', recipientEmail);
    console.log('📧 [EMAIL API] Assunto:', subject);
    console.log('📧 [EMAIL API] Tentando enviar email...');

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [recipientEmail],
      subject: subject,
      html: emailHtml,
    });

    if (error) {
      console.error('❌ [EMAIL API] Erro no Resend:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log('✅ [EMAIL API] Email enviado com sucesso!');
    console.log('✅ [EMAIL API] ID:', data?.id);
    console.log('✅ [EMAIL API] Enviado para:', recipientEmail);

    return NextResponse.json({ success: true, id: data?.id, sentTo: recipientEmail });
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
