import type { CollectionConfig } from 'payload/types';
import { isAdmin, isBookingOwnerOrVetOrAdmin } from '../access/index';

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['user', 'dog', 'veterinarian', 'scheduledAt', 'status', 'type'],
    group: 'Healthcare',
  },
  access: {
    create: ({ req: { user } }) => !!user,
    read: isBookingOwnerOrVetOrAdmin,
    update: isBookingOwnerOrVetOrAdmin,
    delete: isAdmin,
    admin: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    // Relationships
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      label: 'Proprietario',
      hooks: {
        beforeChange: [
          ({ req, value }) => {
            if (req.user?.role !== 'admin' && req.user?.role !== 'veterinarian') {
              return req.user.id;
            }
            return value;
          },
        ],
      },
    },
    {
      name: 'dog',
      type: 'relationship',
      relationTo: 'dogs',
      required: true,
      label: 'Cane',
      admin: {
        condition: (data, siblingData, { user }) => {
          // Filter dogs by owner if not admin
          if (user?.role !== 'admin') {
            return { owner: { equals: user.id } };
          }
          return true;
        },
      },
    },
    {
      name: 'veterinarian',
      type: 'relationship',
      relationTo: 'veterinarians',
      required: true,
      label: 'Veterinario',
    },

    // Booking Details
    {
      name: 'type',
      type: 'select',
      required: true,
      label: 'Tipo Visita',
      options: [
        {
          label: 'Visita Generale',
          value: 'general',
        },
        {
          label: 'Visita Urgente',
          value: 'urgent',
        },
        {
          label: 'Visita Specialistica',
          value: 'specialist',
        },
        {
          label: 'Telemedicina',
          value: 'telemedicine',
        },
      ],
      defaultValue: 'general',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      label: 'Stato',
      options: [
        {
          label: 'In Attesa',
          value: 'pending',
        },
        {
          label: 'Confermata',
          value: 'confirmed',
        },
        {
          label: 'In Corso',
          value: 'in_progress',
        },
        {
          label: 'Completata',
          value: 'completed',
        },
        {
          label: 'Annullata',
          value: 'cancelled',
        },
        {
          label: 'Non Presentato',
          value: 'no_show',
        },
      ],
      defaultValue: 'pending',
    },

    // Scheduling
    {
      name: 'scheduledAt',
      type: 'date',
      required: true,
      label: 'Data e Ora',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
      validate: (val) => {
        const now = new Date();
        const scheduledDate = new Date(val);
        
        if (scheduledDate <= now) {
          return 'La data deve essere futura';
        }
        
        // Check if it's within business hours (simplified)
        const hour = scheduledDate.getHours();
        if (hour < 8 || hour > 19) {
          return 'La prenotazione deve essere negli orari lavorativi (8:00-19:00)';
        }
        
        return true;
      },
    },
    {
      name: 'duration',
      type: 'number',
      required: true,
      label: 'Durata (minuti)',
      defaultValue: 30,
      min: 15,
      max: 180,
      admin: {
        step: 15,
      },
    },

    // Medical Information
    {
      name: 'symptoms',
      type: 'textarea',
      label: 'Sintomi/Motivo Visita',
      admin: {
        rows: 3,
        placeholder: 'Descrivi i sintomi o il motivo della visita...',
      },
    },
    {
      name: 'urgencyScore',
      type: 'number',
      label: 'Punteggio Urgenza',
      min: 1,
      max: 10,
      admin: {
        description: 'Calcolato automaticamente dal sistema di triage (1=basso, 10=critico)',
        readOnly: true,
      },
    },
    {
      name: 'triageNotes',
      type: 'textarea',
      label: 'Note Triage',
      admin: {
        description: 'Note generate dal sistema di triage automatico',
        readOnly: true,
        rows: 2,
      },
    },

    // Visit Notes (for veterinarians)
    {
      name: 'consultationNotes',
      type: 'richText',
      label: 'Note Consultazione',
      admin: {
        description: 'Note private del veterinario sulla visita',
        condition: (data, siblingData, { user }) => 
          user?.role === 'veterinarian' || user?.role === 'admin',
      },
      access: {
        create: ({ req: { user } }) => user?.role === 'veterinarian' || user?.role === 'admin',
        update: ({ req: { user } }) => user?.role === 'veterinarian' || user?.role === 'admin',
        read: ({ req: { user } }) => user?.role === 'veterinarian' || user?.role === 'admin',
      },
    },
    {
      name: 'diagnosis',
      type: 'text',
      label: 'Diagnosi',
      admin: {
        condition: (data, siblingData, { user }) => 
          user?.role === 'veterinarian' || user?.role === 'admin',
      },
      access: {
        create: ({ req: { user } }) => user?.role === 'veterinarian' || user?.role === 'admin',
        update: ({ req: { user } }) => user?.role === 'veterinarian' || user?.role === 'admin',
        read: ({ req: { user } }) => user?.role === 'veterinarian' || user?.role === 'admin',
      },
    },
    {
      name: 'treatment',
      type: 'textarea',
      label: 'Trattamento',
      admin: {
        condition: (data, siblingData, { user }) => 
          user?.role === 'veterinarian' || user?.role === 'admin',
        rows: 3,
      },
      access: {
        create: ({ req: { user } }) => user?.role === 'veterinarian' || user?.role === 'admin',
        update: ({ req: { user } }) => user?.role === 'veterinarian' || user?.role === 'admin',
        read: ({ req: { user } }) => user?.role === 'veterinarian' || user?.role === 'admin',
      },
    },

    // Follow-up
    {
      name: 'followUpRequired',
      type: 'checkbox',
      label: 'Follow-up Necessario',
      defaultValue: false,
      admin: {
        condition: (data, siblingData, { user }) => 
          user?.role === 'veterinarian' || user?.role === 'admin',
      },
    },
    {
      name: 'followUpDate',
      type: 'date',
      label: 'Data Follow-up',
      admin: {
        condition: (data, siblingData) => siblingData?.followUpRequired === true,
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },
    {
      name: 'followUpNotes',
      type: 'textarea',
      label: 'Note Follow-up',
      admin: {
        condition: (data, siblingData) => siblingData?.followUpRequired === true,
        rows: 2,
      },
    },

    // Payment Information
    {
      name: 'totalCost',
      type: 'number',
      required: true,
      label: 'Costo Totale (€)',
      min: 0,
      admin: {
        step: 5,
      },
    },
    {
      name: 'paymentStatus',
      type: 'select',
      required: true,
      label: 'Stato Pagamento',
      options: [
        {
          label: 'In Attesa',
          value: 'pending',
        },
        {
          label: 'Pagato',
          value: 'paid',
        },
        {
          label: 'Rimborsato',
          value: 'refunded',
        },
        {
          label: 'Fallito',
          value: 'failed',
        },
      ],
      defaultValue: 'pending',
    },
    {
      name: 'paymentIntentId',
      type: 'text',
      label: 'ID Pagamento Stripe',
      admin: {
        readOnly: true,
        description: 'ID del pagamento su Stripe',
      },
    },
    {
      name: 'paymentMethod',
      type: 'select',
      label: 'Metodo Pagamento',
      options: [
        { label: 'Carta di Credito', value: 'card' },
        { label: 'PayPal', value: 'paypal' },
        { label: 'Bonifico', value: 'transfer' },
        { label: 'Contanti', value: 'cash' },
      ],
    },

    // Cancellation
    {
      name: 'cancelledReason',
      type: 'select',
      label: 'Motivo Annullamento',
      options: [
        { label: 'Richiesta del cliente', value: 'client_request' },
        { label: 'Indisponibilità veterinario', value: 'vet_unavailable' },
        { label: 'Emergenza', value: 'emergency' },
        { label: 'Problemi tecnici', value: 'technical_issues' },
        { label: 'Altro', value: 'other' },
      ],
      admin: {
        condition: (data, siblingData) => siblingData?.status === 'cancelled',
      },
    },
    {
      name: 'cancellationNotes',
      type: 'textarea',
      label: 'Note Annullamento',
      admin: {
        condition: (data, siblingData) => siblingData?.status === 'cancelled',
        rows: 2,
      },
    },

    // Telemedicine
    {
      name: 'videoCallUrl',
      type: 'text',
      label: 'URL Videochiamata',
      admin: {
        condition: (data, siblingData) => siblingData?.type === 'telemedicine',
        readOnly: true,
        description: 'Generato automaticamente per appuntamenti telemedicina',
      },
    },
    {
      name: 'videoCallStarted',
      type: 'date',
      label: 'Inizio Chiamata',
      admin: {
        condition: (data, siblingData) => siblingData?.type === 'telemedicine',
        readOnly: true,
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'videoCallEnded',
      type: 'date',
      label: 'Fine Chiamata',
      admin: {
        condition: (data, siblingData) => siblingData?.type === 'telemedicine',
        readOnly: true,
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },

    // Rating & Feedback
    {
      name: 'customerRating',
      type: 'number',
      label: 'Valutazione Cliente',
      min: 1,
      max: 5,
      admin: {
        condition: (data, siblingData) => siblingData?.status === 'completed',
        description: 'Valutazione data dal cliente (1-5 stelle)',
      },
    },
    {
      name: 'customerFeedback',
      type: 'textarea',
      label: 'Feedback Cliente',
      admin: {
        condition: (data, siblingData) => siblingData?.customerRating,
        rows: 3,
      },
    },
  ],
  hooks: {
    beforeChange: [
      // Auto-calculate cost based on veterinarian fees
      async ({ req, operation, data, originalDoc }) => {
        if (operation === 'create' || (data.veterinarian && data.veterinarian !== originalDoc?.veterinarian)) {
          const veterinarian = await req.payload.findByID({
            collection: 'veterinarians',
            id: data.veterinarian,
          });

          if (veterinarian) {
            const fees = {
              general: veterinarian.consultationFee,
              urgent: veterinarian.emergencyFee,
              specialist: veterinarian.consultationFee * 1.5,
              telemedicine: veterinarian.telemedicineFee,
            };
            data.totalCost = fees[data.type] || veterinarian.consultationFee;
          }
        }
        return data;
      },
      // Generate video call URL for telemedicine
      async ({ data, operation }) => {
        if (data.type === 'telemedicine' && operation === 'create') {
          // TODO: Generate Daily.co room URL
          const { CryptoUtils } = await import('@doggo/utils');
          data.videoCallUrl = `https://doggo.daily.co/${CryptoUtils.generateSecureId(12)}`;
        }
        return data;
      },
    ],
    afterChange: [
      // Send notifications based on status changes
      async ({ req, operation, doc, previousDoc }) => {
        const statusChanged = operation === 'update' && doc.status !== previousDoc?.status;
        
        if (statusChanged) {
          const { NotificationUtils } = await import('@doggo/utils');
          
          switch (doc.status) {
            case 'confirmed':
              // TODO: Send confirmation email/SMS
              console.log(`Booking ${doc.id} confirmed - send notification`);
              break;
            case 'cancelled':
              // TODO: Send cancellation notification
              console.log(`Booking ${doc.id} cancelled - send notification`);
              break;
            case 'completed':
              // TODO: Send completion notification and feedback request
              console.log(`Booking ${doc.id} completed - request feedback`);
              break;
          }
        }
      },
      // Update veterinarian statistics
      async ({ req, operation, doc, previousDoc }) => {
        if (operation === 'update' && doc.status !== previousDoc?.status) {
          // TODO: Update veterinarian booking statistics
          console.log(`Update stats for veterinarian ${doc.veterinarian}`);
        }
      },
    ],
  },
  endpoints: [
    {
      path: '/my-bookings',
      method: 'get',
      handler: async (req, res) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const { status, upcoming } = req.query;
        let where: any = {};

        if (req.user.role === 'veterinarian') {
          // Find veterinarian profile
          const vetProfile = await req.payload.find({
            collection: 'veterinarians',
            where: { user: { equals: req.user.id } },
            limit: 1,
          });
          
          if (vetProfile.docs.length > 0) {
            where.veterinarian = { equals: vetProfile.docs[0].id };
          } else {
            return res.json({ docs: [], totalDocs: 0 });
          }
        } else {
          where.user = { equals: req.user.id };
        }

        if (status) {
          where.status = { equals: status };
        }

        if (upcoming === 'true') {
          where.scheduledAt = { greater_than: new Date().toISOString() };
          where.status = { in: ['pending', 'confirmed'] };
        }

        const bookings = await req.payload.find({
          collection: 'bookings',
          where,
          populate: ['user', 'dog', 'veterinarian'],
          sort: upcoming === 'true' ? 'scheduledAt' : '-scheduledAt',
          limit: parseInt(req.query.limit as string) || 20,
          page: parseInt(req.query.page as string) || 1,
        });

        return res.json(bookings);
      },
    },
    {
      path: '/:id/cancel',
      method: 'patch',
      handler: async (req, res) => {
        const { id } = req.params;
        const { reason, notes } = req.body;

        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const booking = await req.payload.findByID({
          collection: 'bookings',
          id,
        });

        if (!booking) {
          return res.status(404).json({ error: 'Booking not found' });
        }

        // Check authorization
        if (req.user.role !== 'admin' && booking.user !== req.user.id) {
          const vetProfile = await req.payload.find({
            collection: 'veterinarians',
            where: { user: { equals: req.user.id } },
            limit: 1,
          });
          
          if (vetProfile.docs.length === 0 || booking.veterinarian !== vetProfile.docs[0].id) {
            return res.status(403).json({ error: 'Not authorized' });
          }
        }

        // Check if cancellation is allowed
        const now = new Date();
        const scheduledAt = new Date(booking.scheduledAt);
        const hoursUntilAppointment = (scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilAppointment < 24 && req.user.role !== 'admin') {
          return res.status(400).json({ 
            error: 'Cancellazioni consentite solo con almeno 24 ore di anticipo' 
          });
        }

        const updatedBooking = await req.payload.update({
          collection: 'bookings',
          id,
          data: {
            status: 'cancelled',
            cancelledReason: reason,
            cancellationNotes: notes,
          },
        });

        // TODO: Process refund if payment was made
        if (booking.paymentStatus === 'paid') {
          console.log(`Process refund for booking ${id}`);
        }

        return res.json(updatedBooking);
      },
    },
    {
      path: '/:id/reschedule',
      method: 'patch',
      handler: async (req, res) => {
        const { id } = req.params;
        const { newDateTime } = req.body;

        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const booking = await req.payload.findByID({
          collection: 'bookings',
          id,
        });

        if (!booking) {
          return res.status(404).json({ error: 'Booking not found' });
        }

        // Check authorization
        if (req.user.role !== 'admin' && booking.user !== req.user.id) {
          return res.status(403).json({ error: 'Not authorized' });
        }

        // Validate new date/time
        const newDate = new Date(newDateTime);
        const now = new Date();

        if (newDate <= now) {
          return res.status(400).json({ error: 'New date must be in the future' });
        }

        // Check availability
        const { db } = await import('@doggo/database');
        const availableSlots = await db.getVeterinarianAvailability(
          booking.veterinarian,
          newDate
        );

        const timeString = newDate.toTimeString().substr(0, 5);
        if (!availableSlots.includes(timeString)) {
          return res.status(400).json({ error: 'Selected time slot is not available' });
        }

        const updatedBooking = await req.payload.update({
          collection: 'bookings',
          id,
          data: {
            scheduledAt: newDateTime,
            status: 'pending', // Reset status for re-confirmation
          },
        });

        return res.json(updatedBooking);
      },
    },
    {
      path: '/:id/complete',
      method: 'patch',
      handler: async (req, res) => {
        const { id } = req.params;
        const { diagnosis, treatment, consultationNotes, followUpRequired, followUpDate } = req.body;

        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        // Check if user is veterinarian
        if (req.user.role !== 'veterinarian' && req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Only veterinarians can complete bookings' });
        }

        const booking = await req.payload.findByID({
          collection: 'bookings',
          id,
        });

        if (!booking) {
          return res.status(404).json({ error: 'Booking not found' });
        }

        // Verify veterinarian owns this booking
        if (req.user.role !== 'admin') {
          const vetProfile = await req.payload.find({
            collection: 'veterinarians',
            where: { user: { equals: req.user.id } },
            limit: 1,
          });
          
          if (vetProfile.docs.length === 0 || booking.veterinarian !== vetProfile.docs[0].id) {
            return res.status(403).json({ error: 'Not authorized' });
          }
        }

        const updatedBooking = await req.payload.update({
          collection: 'bookings',
          id,
          data: {
            status: 'completed',
            diagnosis,
            treatment,
            consultationNotes,
            followUpRequired: followUpRequired || false,
            followUpDate: followUpRequired ? followUpDate : null,
          },
        });

        return res.json(updatedBooking);
      },
    },
    {
      path: '/:id/rate',
      method: 'patch',
      handler: async (req, res) => {
        const { id } = req.params;
        const { rating, feedback } = req.body;

        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        if (!rating || rating < 1 || rating > 5) {
          return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        const booking = await req.payload.findByID({
          collection: 'bookings',
          id,
        });

        if (!booking) {
          return res.status(404).json({ error: 'Booking not found' });
        }

        // Check if user owns this booking
        if (req.user.role !== 'admin' && booking.user !== req.user.id) {
          return res.status(403).json({ error: 'Not authorized' });
        }

        // Check if booking is completed
        if (booking.status !== 'completed') {
          return res.status(400).json({ error: 'Can only rate completed bookings' });
        }

        const updatedBooking = await req.payload.update({
          collection: 'bookings',
          id,
          data: {
            customerRating: rating,
            customerFeedback: feedback,
          },
        });

        // Update veterinarian rating
        const veterinarian = await req.payload.findByID({
          collection: 'veterinarians',
          id: booking.veterinarian,
        });

        if (veterinarian) {
          const newTotalReviews = (veterinarian.totalReviews || 0) + 1;
          const currentTotal = (veterinarian.rating || 0) * (veterinarian.totalReviews || 0);
          const newRating = (currentTotal + rating) / newTotalReviews;

          await req.payload.update({
            collection: 'veterinarians',
            id: booking.veterinarian,
            data: {
              rating: Math.round(newRating * 10) / 10, // Round to 1 decimal
              totalReviews: newTotalReviews,
            },
          });
        }

        return res.json(updatedBooking);
      },
    },
    {
      path: '/triage',
      method: 'post',
      handler: async (req, res) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const { responses } = req.body;

        if (!Array.isArray(responses)) {
          return res.status(400).json({ error: 'Responses must be an array' });
        }

        const { TriageSystem } = await import('@doggo/utils');
        const triageResult = TriageSystem.calculateTriageScore(responses);

        return res.json(triageResult);
      },
    },
    {
      path: '/available-slots',
      method: 'get',
      handler: async (req, res) => {
        const { veterinarianId, date } = req.query;

        if (!veterinarianId || !date) {
          return res.status(400).json({ error: 'Veterinarian ID and date are required' });
        }

        const { db } = await import('@doggo/database');
        const availableSlots = await db.getVeterinarianAvailability(
          veterinarianId as string,
          new Date(date as string)
        );

        return res.json({ availableSlots });
      },
    },
  ],
};