import twilio from 'twilio';
import payload from 'payload';

export class SMSService {
  private client: twilio.Twilio;

  constructor() {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.warn('Twilio credentials not configured');
      return;
    }

    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  async sendSMS(to: string, message: string): Promise<void> {
    if (!this.client) {
      console.log('📱 SMS would be sent (no Twilio configured):', { to, message });
      return;
    }

    try {
      const result = await this.client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to,
      });

      payload.logger.info(`SMS sent to ${to}: ${result.sid}`);
    } catch (error) {
      payload.logger.error('Failed to send SMS:', error);
      throw error;
    }
  }

  async sendTemplatedSMS(to: string, templateId: string, data: any): Promise<void> {
    try {
      // Get template from database
      const template = await payload.find({
        collection: 'sms-templates',
        where: {
          name: { equals: templateId },
          isActive: { equals: true },
        },
        limit: 1,
      });

      if (template.docs.length === 0) {
        throw new Error(`SMS template ${templateId} not found`);
      }

      const smsTemplate = template.docs[0];
      let content = smsTemplate.content;

      // Replace variables in template
      Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(regex, data[key] || '');
      });

      await this.sendSMS(to, content);
    } catch (error) {
      payload.logger.error(`Failed to send templated SMS ${templateId}:`, error);
      throw error;
    }
  }

  async sendBookingReminder(booking: any, user: any, veterinarian: any): Promise<void> {
    await this.sendTemplatedSMS(
      user.phone,
      'booking_reminder',
      {
        dogName: booking.dog.name,
        clinicName: veterinarian.clinicName,
        time: new Date(booking.scheduledAt).toLocaleTimeString('it-IT', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        phone: veterinarian.contactInfo?.phone || '',
      }
    );
  }

  async sendEmergencyAlert(user: any, emergency: any, distance: number): Promise<void> {
    await this.sendTemplatedSMS(
      user.phone,
      'emergency_alert',
      {
        emergencyType: this.getEmergencyTypeLabel(emergency.type),
        distance: distance.toFixed(1),
        url: `${process.env.NEXTAUTH_URL}/emergencies/${emergency.id}`,
      }
    );
  }

  async sendMatchNotification(user: any, dog1: any, dog2: any, matchScore: number): Promise<void> {
    await this.sendTemplatedSMS(
      user.phone,
      'match_notification',
      {
        dog1: dog1.name,
        dog2: dog2.name,
        score: matchScore,
      }
    );
  }

  async sendVerificationCode(phone: string, code: string): Promise<void> {
    const message = `Il tuo codice di verifica Doggo è: ${code}. Non condividerlo con nessuno.`;
    await this.sendSMS(phone, message);
  }

  async sendAdoptionUpdate(user: any, application: any, status: string): Promise<void> {
    const statusLabels = {
      approved: 'approvata',
      rejected: 'respinta',
      interview: 'richiede colloquio',
      home_visit: 'richiede visita domiciliare',
      completed: 'completata con successo',
    };

    const message = `Aggiornamento richiesta adozione: La tua richiesta per ${application.dog.name} è stata ${statusLabels[status] || status}. Controlla l'app per dettagli.`;
    
    if (user.phone && user.preferences?.notifications?.sms) {
      await this.sendSMS(user.phone, message);
    }
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

  async getSMSStats(days: number = 30) {
    // This would integrate with Twilio's usage API in production
    return {
      sent: 0,
      delivered: 0,
      failed: 0,
      period: `${days} days`,
    };
  }

  async validatePhoneNumber(phone: string): Promise<boolean> {
    if (!this.client) {
      return /^\+?[1-9]\d{1,14}$/.test(phone);
    }

    try {
      const lookup = await this.client.lookups.v1.phoneNumbers(phone).fetch();
      return lookup.phoneNumber !== null;
    } catch (error) {
      payload.logger.warn(`Phone number validation failed for ${phone}:`, error);
      return false;
    }
  }
}