import sgMail from '@sendgrid/mail';
import payload from 'payload';

export class EmailService {
  constructor() {
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }
  }

  async sendEmail(to: string, subject: string, html: string, text?: string) {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('📧 Email would be sent (no SendGrid configured):', { to, subject });
      return;
    }

    const msg = {
      to,
      from: {
        email: process.env.FROM_EMAIL || 'noreply@doggo.com',
        name: process.env.FROM_NAME || 'Doggo Platform',
      },
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    };

    try {
      await sgMail.send(msg);
      payload.logger.info(`Email sent to ${to}`);
    } catch (error) {
      payload.logger.error('Failed to send email:', error);
      throw error;
    }
  }

  async sendTemplatedEmail(to: string, subject: string, templateId: string, data: any) {
    try {
      // Get template from database
      const template = await payload.findGlobal({
        slug: 'email-templates',
      });

      const emailTemplate = template.templates?.find((t: any) => t.name === templateId);
      
      if (!emailTemplate) {
        throw new Error(`Email template ${templateId} not found`);
      }

      // Replace variables in template
      let html = emailTemplate.htmlContent;
      let text = emailTemplate.textContent;
      let finalSubject = emailTemplate.subject || subject;

      // Replace {{variable}} placeholders
      Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, data[key] || '');
        text = text.replace(regex, data[key] || '');
        finalSubject = finalSubject.replace(regex, data[key] || '');
      });

      await this.sendEmail(to, finalSubject, html, text);
    } catch (error) {
      payload.logger.error(`Failed to send templated email ${templateId}:`, error);
      throw error;
    }
  }

  async sendWelcomeEmail(user: any) {
    await this.sendTemplatedEmail(
      user.email,
      'Benvenuto su Doggo!',
      'welcome',
      {
        firstName: user.firstName,
        loginUrl: `${process.env.NEXTAUTH_URL}/login`,
      }
    );
  }

  async sendBookingConfirmation(booking: any, user: any, dog: any, veterinarian: any) {
    await this.sendTemplatedEmail(
      user.email,
      'Prenotazione Confermata',
      'booking_confirmation',
      {
        firstName: user.firstName,
        dogName: dog.name,
        clinicName: veterinarian.clinicName,
        date: new Date(booking.scheduledAt).toLocaleDateString('it-IT'),
        time: new Date(booking.scheduledAt).toLocaleTimeString('it-IT', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        bookingType: this.getBookingTypeLabel(booking.type),
      }
    );
  }

  async sendEmergencyAlert(user: any, emergency: any, distance: number) {
    await this.sendTemplatedEmail(
      user.email,
      '🚨 Allerta Emergenza',
      'emergency_alert',
      {
        firstName: user.firstName,
        emergencyType: this.getEmergencyTypeLabel(emergency.type),
        description: emergency.description,
        location: emergency.location.address,
        distance: distance.toFixed(1),
        emergencyUrl: `${process.env.NEXTAUTH_URL}/emergencies/${emergency.id}`,
      }
    );
  }

  async sendPasswordReset(user: any, resetUrl: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #3B82F6;">Reset Password - Doggo</h1>
        <p>Ciao ${user.firstName},</p>
        <p>Hai richiesto di reimpostare la tua password. Clicca sul pulsante qui sotto:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #EF4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Reimposta Password
          </a>
        </div>
        <p>Questo link scadrà tra 1 ora per motivi di sicurezza.</p>
        <p>Se non hai richiesto il reset della password, puoi ignorare questa email.</p>
      </div>
    `;

    await this.sendEmail(user.email, 'Reset Password - Doggo', html);
  }

  async sendVerificationEmail(user: any, verificationUrl: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #3B82F6;">Verifica Account - Doggo</h1>
        <p>Ciao ${user.firstName},</p>
        <p>Grazie per esserti registrato su Doggo! Clicca sul pulsante qui sotto per verificare il tuo account:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background: #10B981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Verifica Account
          </a>
        </div>
        <p>Se non riesci a cliccare il pulsante, copia e incolla questo link nel tuo browser:</p>
        <p style="word-break: break-all; color: #6B7280;">${verificationUrl}</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">
        <p style="color: #6B7280; font-size: 14px;">
          Se non hai creato un account su Doggo, puoi ignorare questa email.
        </p>
      </div>
    `;

    await this.sendEmail(user.email, 'Verifica il tuo account - Doggo', html);
  }

  async sendAdoptionApplicationConfirmation(application: any, user: any, dog: any, shelter: any) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #3B82F6;">Richiesta di Adozione Inviata</h1>
        <p>Ciao ${user.firstName},</p>
        <p>La tua richiesta di adozione per <strong>${dog.name}</strong> è stata inviata con successo!</p>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Dettagli Richiesta</h3>
          <p><strong>Cane:</strong> ${dog.name}</p>
          <p><strong>Canile:</strong> ${shelter.name}</p>
          <p><strong>Data Richiesta:</strong> ${new Date().toLocaleDateString('it-IT')}</p>
          <p><strong>Stato:</strong> In Revisione</p>
        </div>
        <p>Il canile esaminerà la tua richiesta e ti contatterà presto. Nel frattempo, puoi seguire lo stato della tua richiesta nel tuo profilo.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXTAUTH_URL}/profile/adoptions" style="background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Visualizza Richieste
          </a>
        </div>
      </div>
    `;

    await this.sendEmail(user.email, `Richiesta di Adozione - ${dog.name}`, html);
  }

  async sendDonationConfirmation(donation: any, user: any, shelter: any) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #10B981;">Grazie per la tua Donazione!</h1>
        <p>Ciao ${user.firstName},</p>
        <p>Grazie infinite per la tua generosa donazione a favore di <strong>${shelter.name}</strong>!</p>
        <div style="background: #F0FDF4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981;">
          <h3 style="margin-top: 0; color: #047857;">Riepilogo Donazione</h3>
          <p><strong>Importo:</strong> €${donation.amount}</p>
          <p><strong>Beneficiario:</strong> ${shelter.name}</p>
          <p><strong>Finalità:</strong> ${this.getDonationPurposeLabel(donation.purpose)}</p>
          <p><strong>Data:</strong> ${new Date().toLocaleDateString('it-IT')}</p>
          ${donation.message ? `<p><strong>Messaggio:</strong> "${donation.message}"</p>` : ''}
        </div>
        <p>La tua donazione aiuterà a migliorare la vita degli animali in difficoltà. Riceverai una ricevuta fiscale via email entro 48 ore.</p>
        <p>Grazie ancora per il tuo prezioso supporto! 🐕❤️</p>
      </div>
    `;

    await this.sendEmail(user.email, 'Grazie per la tua donazione!', html);
  }

  async sendNewMatchNotification(user: any, dog1: any, dog2: any, matchScore: number) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #EC4899;">💖 Nuovo Match!</h1>
        <p>Ciao ${user.firstName},</p>
        <p>Abbiamo trovato una perfetta compatibilità per ${dog1.name}!</p>
        <div style="background: #FDF2F8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="text-align: center;">
              <img src="${dog1.photos[0] || ''}" alt="${dog1.name}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;">
              <h4>${dog1.name}</h4>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px;">💖</div>
              <div style="font-weight: bold; color: #EC4899;">${matchScore}% compatibili!</div>
            </div>
            <div style="text-align: center;">
              <img src="${dog2.photos[0] || ''}" alt="${dog2.name}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;">
              <h4>${dog2.name}</h4>
            </div>
          </div>
        </div>
        <p>Puoi iniziare a chattare e organizzare un incontro per far conoscere i due amici a quattro zampe!</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXTAUTH_URL}/tindog/matches" style="background: #EC4899; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Inizia a Chattare
          </a>
        </div>
      </div>
    `;

    await this.sendEmail(user.email, '💖 Nuovo Match per il tuo cane!', html);
  }

  private getBookingTypeLabel(type: string): string {
    const labels = {
      general: 'Visita Generale',
      urgent: 'Visita Urgente',
      specialist: 'Visita Specialistica',
      telemedicine: 'Telemedicina',
    };
    return labels[type as keyof typeof labels] || type;
  }

  private getEmergencyTypeLabel(type: string): string {
    const labels = {
      lost_dog: 'Cane Smarrito',
      found_dog: 'Cane Trovato',
      injured_dog: 'Cane Ferito',
      abandoned_dog: 'Cane Abbandonato',
    };
    return labels[type as keyof typeof labels] || type;
  }

  private getDonationPurposeLabel(purpose: string): string {
    const labels = {
      general: 'Supporto Generale',
      medical: 'Cure Mediche',
      food: 'Alimentazione',
      shelter: 'Strutture',
      specific_dog: 'Cane Specifico',
    };
    return labels[purpose as keyof typeof labels] || purpose;
  }

  async sendBulkEmail(recipients: string[], subject: string, html: string) {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('📧 Bulk email would be sent (no SendGrid configured):', { 
        recipientCount: recipients.length, 
        subject 
      });
      return;
    }

    const messages = recipients.map(email => ({
      to: email,
      from: {
        email: process.env.FROM_EMAIL || 'noreply@doggo.com',
        name: process.env.FROM_NAME || 'Doggo Platform',
      },
      subject,
      html,
    }));

    try {
      await sgMail.send(messages);
      payload.logger.info(`Bulk email sent to ${recipients.length} recipients`);
    } catch (error) {
      payload.logger.error('Failed to send bulk email:', error);
      throw error;
    }
  }

  async getEmailStats(days: number = 30) {
    // This would integrate with SendGrid's stats API in production
    return {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      period: `${days} days`,
    };
  }
}