import { adminDb } from '@/lib/firebase-admin';
import { differenceInDays } from 'date-fns';

export async function GET(request) {
  try {
    // 1. Verify CRON_SECRET to prevent unauthorized execution
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (!adminDb) {
      return new Response('Firebase Admin not initialized', { status: 500 });
    }

    const today = new Date();
    
    // 2. Fetch all tickets with nf_emitted
    const snapshot = await adminDb.collection('tickets')
      .where('status', '==', 'nf_emitted')
      .get();

    let processedCount = 0;

    for (const doc of snapshot.docs) {
      const ticket = doc.data();
      ticket.id = doc.id; // ensure ID is attached
      
      if (ticket.nfReturnDeadline && !ticket.nfReminderSent) {
        const deadline = new Date(ticket.nfReturnDeadline);
        const daysLeft = differenceInDays(deadline, today);

        // 3. If deadline is 10 days or less away (and not completely expired or deeply negative)
        // We trigger the email.
        if (daysLeft <= 10 && daysLeft >= 0) {
          
          // Call the internal notify-ticket API route via absolute URL
          // If we are in Vercel, use process.env.VERCEL_URL
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
            
          const notifyResponse = await fetch(`${baseUrl}/api/notify-ticket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'nf_reminder',
              ticket: ticket,
              user: { name: 'Sistema Automático' }
            })
          });

          if (notifyResponse.ok) {
            // 4. Mark as sent in DB
            await doc.ref.update({
              nfReminderSent: true
            });
            processedCount++;
          } else {
            console.error(`Failed to send email for ticket ${ticket.id}`);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed: processedCount }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in cron job:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
