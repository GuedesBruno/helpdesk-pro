// src/app/api/send-email/route.js
import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { to, subject, html, type, ticketData } = await request.json();

    // Validar dados
    if (!to || !subject) {
      return NextResponse.json(
        { error: 'Email e assunto são obrigatórios' },
        { status: 400 }
      );
    }

    // Gerar HTML baseado no tipo de notificação
    const emailHtml = html || generateEmailTemplate(type, ticketData);

    // Usar email do .env ou fallback
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Helpdesk Teca <onboarding@resend.dev>';

    // Enviar email
    const data = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject: subject,
      html: emailHtml,
    });

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar email', details: error.message },
      { status: 500 }
    );
  }
}

// Templates de email
function generateEmailTemplate(type, data) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const ticketUrl = `${baseUrl}/?ticket=${data.ticketId}`;

  const templates = {
    ticket_assigned: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #002554;">Novo Chamado Atribuído</h2>
        <p>Olá <strong>${data.attendantName}</strong>,</p>
        <p>Um novo chamado foi atribuído para você:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Assunto:</strong> ${data.ticketSubject}</p>
          <p><strong>Criado por:</strong> ${data.collaboratorName}</p>
          <p><strong>Prioridade:</strong> ${data.priority}</p>
          <p><strong>Departamento:</strong> ${data.department}</p>
        </div>
        <a href="${ticketUrl}" style="display: inline-block; background: #002554; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 10px;">
          Ver Chamado
        </a>
      </div>
    `,

    ticket_started: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #002554;">Seu Chamado Foi Iniciado</h2>
        <p>Olá <strong>${data.collaboratorName}</strong>,</p>
        <p>O atendente <strong>${data.attendantName}</strong> iniciou o atendimento do seu chamado:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Assunto:</strong> ${data.ticketSubject}</p>
          <p><strong>Status:</strong> <span style="color: #0066cc;">Iniciado</span></p>
        </div>
        <a href="${ticketUrl}" style="display: inline-block; background: #002554; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 10px;">
          Ver Chamado
        </a>
      </div>
    `,

    status_analyzing: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #002554;">Chamado Em Análise</h2>
        <p>Olá <strong>${data.collaboratorName}</strong>,</p>
        <p>Seu chamado está sendo analisado pelo atendente <strong>${data.attendantName}</strong>:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Assunto:</strong> ${data.ticketSubject}</p>
          <p><strong>Status:</strong> <span style="color: #f59e0b;">Em Análise</span></p>
        </div>
        <a href="${ticketUrl}" style="display: inline-block; background: #002554; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 10px;">
          Ver Chamado
        </a>
      </div>
    `,

    request_info: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #002554;">Informação Adicional Necessária</h2>
        <p>Olá <strong>${data.collaboratorName}</strong>,</p>
        <p>O atendente <strong>${data.attendantName}</strong> solicitou informações adicionais sobre seu chamado:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Assunto:</strong> ${data.ticketSubject}</p>
          <p><strong>Mensagem:</strong> ${data.requestMessage || 'Por favor, forneça mais informações.'}</p>
        </div>
        <a href="${ticketUrl}" style="display: inline-block; background: #002554; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 10px;">
          Responder
        </a>
      </div>
    `,

    ticket_resolved: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Seu Chamado Foi Resolvido</h2>
        <p>Olá <strong>${data.collaboratorName}</strong>,</p>
        <p>Seu chamado foi resolvido pelo atendente <strong>${data.attendantName}</strong>:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Assunto:</strong> ${data.ticketSubject}</p>
          <p><strong>Status:</strong> <span style="color: #10b981;">Resolvido</span></p>
          ${data.resolutionMessage ? `<p><strong>Resolução:</strong> ${data.resolutionMessage}</p>` : ''}
        </div>
        <a href="${ticketUrl}" style="display: inline-block; background: #002554; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 10px;">
          Ver Chamado
        </a>
      </div>
    `,

    ticket_canceled: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Chamado Cancelado</h2>
        <p>Olá <strong>${data.attendantName}</strong>,</p>
        <p>O chamado que estava atribuído a você foi cancelado pelo colaborador:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Assunto:</strong> ${data.ticketSubject}</p>
          <p><strong>Colaborador:</strong> ${data.collaboratorName}</p>
          <p><strong>Status:</strong> <span style="color: #dc2626;">Cancelado</span></p>
        </div>
      </div>
    `,

    collaborator_response: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #002554;">Colaborador Respondeu</h2>
        <p>Olá <strong>${data.attendantName}</strong>,</p>
        <p>O colaborador <strong>${data.collaboratorName}</strong> respondeu à sua solicitação de informação:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Assunto:</strong> ${data.ticketSubject}</p>
          <p><strong>Resposta:</strong></p>
          <blockquote style="border-left: 4px solid #002554; padding-left: 15px; margin: 10px 0; color: #333;">
            ${data.responseMessage}
          </blockquote>
        </div>
        <p>O chamado voltou para o status <strong style="color: #eab308;">Em Análise</strong>.</p>
        <a href="${ticketUrl}" style="display: inline-block; background: #002554; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 10px;">
          Ver Chamado
        </a>
      </div>
    `,
  };

  return templates[type] || `<p>${data.message || 'Notificação do Helpdesk Teca'}</p>`;
}
