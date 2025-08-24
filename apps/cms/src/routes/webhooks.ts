import express from 'express';
import payload from 'payload';
import { authenticateApiKey } from '../middleware/auth';

const router = express.Router();

// Stripe webhook handler
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    
    if (!signature) {
      return res.status(400).json({ error: 'Missing Stripe signature' });
    }

    const paymentService = req.app.locals.services.payment;
    const event = await paymentService.processWebhook(req.body, signature);

    if (!event) {
      return res.status(400).json({ error: 'Invalid webhook' });
    }

    payload.logger.info(`Stripe webhook processed: ${event.type}`);
    res.status(200).json({ received: true });
  } catch (error) {
    payload.logger.error('Stripe webhook error:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// Daily.co webhook handler
router.post('/daily', express.json(), authenticateApiKey, async (req, res) => {
  try {
    const videoCallService = req.app.locals.services.videoCall;
    await videoCallService.handleWebhook(req.body);

    payload.logger.info(`Daily.co webhook processed: ${req.body.type}`);
    res.status(200).json({ received: true });
  } catch (error) {
    payload.logger.error('Daily.co webhook error:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// SendGrid webhook handler
router.post('/sendgrid', express.json(), authenticateApiKey, async (req, res) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];

    for (const event of events) {
      const { event: eventType, email, timestamp } = event;

      // Update email statistics based on event type
      switch (eventType) {
        case 'delivered':
          payload.logger.info(`Email delivered to ${email}`);
          break;

        case 'open':
          payload.logger.info(`Email opened by ${email}`);
          break;

        case 'click':
          payload.logger.info(`Email link clicked by ${email}`);
          break;

        case 'bounce':
        case 'dropped':
          payload.logger.warn(`Email ${eventType} for ${email}: ${event.reason}`);
          break;

        case 'unsubscribe':
          payload.logger.info(`User unsubscribed: ${email}`);
          // TODO: Update user preferences
          break;

        default:
          payload.logger.info(`Unhandled SendGrid event: ${eventType}`);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    payload.logger.error('SendGrid webhook error:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// Twilio webhook handler  
router.post('/twilio', express.urlencoded({ extended: true }), authenticateApiKey, async (req, res) => {
  try {
    const { MessageStatus, MessageSid, To, ErrorCode } = req.body;

    switch (MessageStatus) {
      case 'delivered':
        payload.logger.info(`SMS delivered: ${MessageSid} to ${To}`);
        break;

      case 'failed':
      case 'undelivered':
        payload.logger.error(`SMS ${MessageStatus}: ${MessageSid} to ${To}, Error: ${ErrorCode}`);
        break;

      default:
        payload.logger.info(`SMS status update: ${MessageStatus} for ${MessageSid}`);
    }

    res.status(200).send('OK');
  } catch (error) {
    payload.logger.error('Twilio webhook error:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// Generic webhook handler for external integrations
router.post('/external/:service', express.json(), authenticateApiKey, async (req, res) => {
  try {
    const { service } = req.params;
    const { event, data } = req.body;

    // Log the webhook for debugging
    payload.logger.info(`External webhook from ${service}: ${event}`, { data });

    // Store webhook data for later processing
    await payload.create({
      collection: 'webhook-logs',
      data: {
        service,
        event,
        data,
        processed: false,
      },
    });

    res.status(200).json({ received: true });
  } catch (error) {
    payload.logger.error('External webhook error:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

export default router;