import Stripe from 'stripe';
import payload from 'payload';

export class PaymentService {
  private stripe: Stripe;

  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }

    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }

  async createPaymentIntent(
    amount: number,
    currency: string = 'eur',
    metadata: any = {}
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      payload.logger.info(`Payment intent created: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error) {
      payload.logger.error('Failed to create payment intent:', error);
      throw error;
    }
  }

  async confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId);
      payload.logger.info(`Payment intent confirmed: ${paymentIntentId}`);
      return paymentIntent;
    } catch (error) {
      payload.logger.error('Failed to confirm payment intent:', error);
      throw error;
    }
  }

  async createBookingPayment(booking: any, user: any): Promise<Stripe.PaymentIntent> {
    const metadata = {
      bookingId: booking.id,
      userId: user.id,
      dogId: booking.dog,
      veterinarianId: booking.veterinarian,
      type: 'booking',
    };

    const paymentIntent = await this.createPaymentIntent(
      booking.totalCost,
      'eur',
      metadata
    );

    // Update booking with payment intent ID
    await payload.update({
      collection: 'bookings',
      id: booking.id,
      data: {
        paymentIntentId: paymentIntent.id,
      },
    });

    return paymentIntent;
  }

  async createDonationPayment(
    amount: number,
    shelterId: string,
    donorId?: string,
    purpose: string = 'general',
    message?: string
  ): Promise<{ paymentIntent: Stripe.PaymentIntent; donation: any }> {
    const metadata = {
      shelterId,
      donorId: donorId || 'anonymous',
      purpose,
      type: 'donation',
    };

    const paymentIntent = await this.createPaymentIntent(amount, 'eur', metadata);

    // Create donation record
    const donation = await payload.create({
      collection: 'donations',
      data: {
        donor: donorId || null,
        shelter: shelterId,
        amount,
        currency: 'EUR',
        purpose,
        isAnonymous: !donorId,
        paymentMethod: 'stripe',
        paymentIntentId: paymentIntent.id,
        status: 'pending',
        message,
      },
    });

    return { paymentIntent, donation };
  }

  async processWebhook(
    payload: string | Buffer,
    signature: string
  ): Promise<Stripe.Event | null> {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET is required');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      await this.handleWebhookEvent(event);
      return event;
    } catch (error) {
      payload.logger.error('Webhook signature verification failed:', error);
      throw error;
    }
  }

  private async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.canceled':
        await this.handlePaymentCanceled(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        payload.logger.info(`Unhandled webhook event type: ${event.type}`);
    }
  }

  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const { type, bookingId, donationId } = paymentIntent.metadata;

    try {
      if (type === 'booking' && bookingId) {
        // Update booking payment status
        await payload.update({
          collection: 'bookings',
          id: bookingId,
          data: {
            paymentStatus: 'paid',
          },
        });

        // Get booking details for notifications
        const booking = await payload.findByID({
          collection: 'bookings',
          id: bookingId,
          populate: ['user', 'dog', 'veterinarian'],
        });

        // Send confirmation email
        const emailService = new (await import('./EmailService')).EmailService();
        await emailService.sendBookingConfirmation(
          booking,
          booking.user,
          booking.dog,
          booking.veterinarian
        );

        payload.logger.info(`Booking payment succeeded: ${bookingId}`);
      } else if (type === 'donation') {
        // Find donation by payment intent ID
        const donations = await payload.find({
          collection: 'donations',
          where: {
            paymentIntentId: { equals: paymentIntent.id },
          },
          populate: ['donor', 'shelter'],
        });

        if (donations.docs.length > 0) {
          const donation = donations.docs[0];
          
          await payload.update({
            collection: 'donations',
            id: donation.id,
            data: {
              status: 'completed',
            },
          });

          // Send confirmation email
          if (donation.donor) {
            const emailService = new (await import('./EmailService')).EmailService();
            await emailService.sendDonationConfirmation(
              donation,
              donation.donor,
              donation.shelter
            );
          }

          payload.logger.info(`Donation payment succeeded: ${donation.id}`);
        }
      }
    } catch (error) {
      payload.logger.error('Failed to handle payment succeeded event:', error);
    }
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const { type, bookingId } = paymentIntent.metadata;

    try {
      if (type === 'booking' && bookingId) {
        await payload.update({
          collection: 'bookings',
          id: bookingId,
          data: {
            paymentStatus: 'failed',
          },
        });

        payload.logger.info(`Booking payment failed: ${bookingId}`);
      } else if (type === 'donation') {
        const donations = await payload.find({
          collection: 'donations',
          where: {
            paymentIntentId: { equals: paymentIntent.id },
          },
        });

        if (donations.docs.length > 0) {
          await payload.update({
            collection: 'donations',
            id: donations.docs[0].id,
            data: {
              status: 'failed',
            },
          });

          payload.logger.info(`Donation payment failed: ${donations.docs[0].id}`);
        }
      }
    } catch (error) {
      payload.logger.error('Failed to handle payment failed event:', error);
    }
  }

  private async handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const { type, bookingId } = paymentIntent.metadata;

    try {
      if (type === 'booking' && bookingId) {
        await payload.update({
          collection: 'bookings',
          id: bookingId,
          data: {
            paymentStatus: 'failed',
            status: 'cancelled',
            cancelledReason: 'payment_failed',
          },
        });

        payload.logger.info(`Booking payment canceled: ${bookingId}`);
      }
    } catch (error) {
      payload.logger.error('Failed to handle payment canceled event:', error);
    }
  }

  async refundPayment(paymentIntentId: string, amount?: number): Promise<Stripe.Refund> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined, // Partial refund if amount specified
      });

      payload.logger.info(`Refund created: ${refund.id} for payment ${paymentIntentId}`);
      return refund;
    } catch (error) {
      payload.logger.error('Failed to create refund:', error);
      throw error;
    }
  }

  async createCustomer(user: any): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        phone: user.phone,
        metadata: {
          userId: user.id,
        },
      });

      // Store customer ID in user record
      await payload.update({
        collection: 'users',
        id: user.id,
        data: {
          stripeCustomerId: customer.id,
        },
      });

      payload.logger.info(`Stripe customer created: ${customer.id} for user ${user.id}`);
      return customer;
    } catch (error) {
      payload.logger.error('Failed to create Stripe customer:', error);
      throw error;
    }
  }

  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
      });

      return setupIntent;
    } catch (error) {
      payload.logger.error('Failed to create setup intent:', error);
      throw error;
    }
  }

  async getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data;
    } catch (error) {
      payload.logger.error('Failed to get payment methods:', error);
      throw error;
    }
  }

  async createSubscription(
    customerId: string,
    priceId: string,
    metadata: any = {}
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        metadata,
      });

      payload.logger.info(`Subscription created: ${subscription.id}`);
      return subscription;
    } catch (error) {
      payload.logger.error('Failed to create subscription:', error);
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.cancel(subscriptionId);
      payload.logger.info(`Subscription canceled: ${subscriptionId}`);
      return subscription;
    } catch (error) {
      payload.logger.error('Failed to cancel subscription:', error);
      throw error;
    }
  }

  async getPaymentStats(days: number = 30) {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    try {
      // Get bookings
      const bookings = await payload.find({
        collection: 'bookings',
        where: {
          createdAt: { greater_than_equal: startDate.toISOString() },
          paymentStatus: { equals: 'paid' },
        },
      });

      // Get donations
      const donations = await payload.find({
        collection: 'donations',
        where: {
          createdAt: { greater_than_equal: startDate.toISOString() },
          status: { equals: 'completed' },
        },
      });

      const bookingRevenue = bookings.docs.reduce((sum, booking) => sum + booking.totalCost, 0);
      const donationRevenue = donations.docs.reduce((sum, donation) => sum + donation.amount, 0);

      return {
        period: `${days} days`,
        bookings: {
          count: bookings.totalDocs,
          revenue: bookingRevenue,
        },
        donations: {
          count: donations.totalDocs,
          revenue: donationRevenue,
        },
        total: {
          transactions: bookings.totalDocs + donations.totalDocs,
          revenue: bookingRevenue + donationRevenue,
        },
      };
    } catch (error) {
      payload.logger.error('Failed to get payment stats:', error);
      throw error;
    }
  }
}