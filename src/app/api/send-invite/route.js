// src/app/api/send-invite/route.js
import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { email, role, token } = await request.json();

    if (!email || !role || !token) {
      return NextResponse.json(
        { error: 'Email, role e token são obrigatórios' },
        { status: 400 }
      );
    }

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite?token=${token}`;

    const roleLabels = {
      colaborador: 'Colaborador',
      atendente: 'Atendente',
      admin: 'Administrador'
    };

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #002554; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Helpdesk Tecassistiva</h1>
        </div>
        
        <div style="padding: 30px; background: #f9fafb;">
          <h2 style="color: #002554; margin-top: 0;">Você foi convidado!</h2>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Você foi convidado para fazer parte do Helpdesk Tecassistiva como <strong>${roleLabels[role]}</strong>.
          </p>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Clique no botão abaixo para completar seu cadastro:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" 
               style="display: inline-block; background: #002554; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Aceitar Convite
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Ou copie e cole este link no seu navegador:<br>
            <a href="${inviteUrl}" style="color: #002554; word-break: break-all;">${inviteUrl}</a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Este convite expira em 7 dias.
          </p>
        </div>
        
        <div style="background: #e5e7eb; padding: 20px; text-align: center;">
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Helpdesk Tecassistiva - TecAssistiva
          </p>
        </div>
      </div>
    `;

    // Usar email do .env ou fallback para onboarding@resend.dev
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Helpdesk Tecassistiva <onboarding@resend.dev>';

    const data = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: 'Convite para Helpdesk Tecassistiva',
      html: emailHtml,
    });

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error('Erro ao enviar convite:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar convite', details: error.message },
      { status: 500 }
    );
  }
}
