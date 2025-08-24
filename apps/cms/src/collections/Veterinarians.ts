import type { CollectionConfig } from 'payload/types';
import { isAdmin, isVeterinarianOrAdmin } from '../access/index';

export const Veterinarians: CollectionConfig = {
  slug: 'veterinarians',
  admin: {
    useAsTitle: 'clinicName',
    defaultColumns: ['user', 'clinicName', 'licenseNumber', 'isVerified', 'rating'],
    group: 'Healthcare',
  },
  access: {
    create: ({ req: { user } }) => user?.role === 'veterinarian' || user?.role === 'admin',
    read: () => true, // Public for search
    update: isVeterinarianOrAdmin,
    delete: isAdmin,
    admin: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    // User Relationship
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      label: 'Utente',
      admin: {
        condition: (_, siblingData, { user }) => user?.role === 'admin',
      },
      hooks: {
        beforeChange: [
          ({ req, value }) => {
            if (req.user?.role !== 'admin') {
              return req.user.id;
            }
            return value;
          },
        ],
      },
    },

    // Professional Info
    {
      name: 'licenseNumber',
      type: 'text',
      required: true,
      unique: true,
      label: 'Numero Albo',
      admin: {
        placeholder: 'VET123456',
        description: 'Numero di iscrizione all\'Ordine dei Veterinari',
      },
    },
    {
      name: 'specializations',
      type: 'select',
      hasMany: true,
      label: 'Specializzazioni',
      options: [
        { label: 'Medicina Generale', value: 'general_medicine' },
        { label: 'Chirurgia', value: 'surgery' },
        { label: 'Dermatologia', value: 'dermatology' },
        { label: 'Cardiologia', value: 'cardiology' },
        { label: 'Neurologia', value: 'neurology' },
        { label: 'Oncologia', value: 'oncology' },
        { label: 'Ortopedia', value: 'orthopedics' },
        { label: 'Oculistica', value: 'ophthalmology' },
        { label: 'Medicina d\'Urgenza', value: 'emergency' },
        { label: 'Comportamentale', value: 'behavioral' },
        { label: 'Nutrizione', value: 'nutrition' },
        { label: 'Geriatria', value: 'geriatrics' },
      ],
    },

    // Clinic Information
    {
      name: 'clinicName',
      type: 'text',
      required: true,
      label: 'Nome Clinica',
      admin: {
        placeholder: 'Clinica Veterinaria San Francesco',
      },
    },
    {
      name: 'clinicAddress',
      type: 'group',
      label: 'Indirizzo Clinica',
      fields: [
        {
          name: 'street',
          type: 'text',
          required: true,
          label: 'Via/Piazza',
        },
        {
          name: 'city',
          type: 'text',
          required: true,
          label: 'Città',
        },
        {
          name: 'state',
          type: 'text',
          required: true,
          label: 'Regione',
        },
        {
          name: 'zipCode',
          type: 'text',
          required: true,
          label: 'CAP',
          validate: (val) => {
            if (!/^\d{5}$/.test(val)) {
              return 'CAP deve essere di 5 cifre';
            }
            return true;
          },
        },
        {
          name: 'country',
          type: 'text',
          label: 'Paese',
          defaultValue: 'IT',
        },
        {
          name: 'coordinates',
          type: 'group',
          label: 'Coordinate GPS',
          admin: {
            description: 'Necessarie per la ricerca geografica',
          },
          fields: [
            {
              name: 'latitude',
              type: 'number',
              required: true,
              label: 'Latitudine',
              admin: {
                step: 0.000001,
              },
            },
            {
              name: 'longitude',
              type: 'number',
              required: true,
              label: 'Longitudine',
              admin: {
                step: 0.000001,
              },
            },
          ],
        },
      ],
    },

    // Working Hours
    {
      name: 'workingHours',
      type: 'array',
      label: 'Orari di Lavoro',
      fields: [
        {
          name: 'dayOfWeek',
          type: 'select',
          required: true,
          label: 'Giorno',
          options: [
            { label: 'Domenica', value: 0 },
            { label: 'Lunedì', value: 1 },
            { label: 'Martedì', value: 2 },
            { label: 'Mercoledì', value: 3 },
            { label: 'Giovedì', value: 4 },
            { label: 'Venerdì', value: 5 },
            { label: 'Sabato', value: 6 },
          ],
        },
        {
          name: 'startTime',
          type: 'text',
          required: true,
          label: 'Orario Inizio',
          admin: {
            placeholder: '09:00',
          },
          validate: (val) => {
            if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(val)) {
              return 'Formato orario non valido (HH:MM)';
            }
            return true;
          },
        },
        {
          name: 'endTime',
          type: 'text',
          required: true,
          label: 'Orario Fine',
          admin: {
            placeholder: '18:00',
          },
          validate: (val) => {
            if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(val)) {
              return 'Formato orario non valido (HH:MM)';
            }
            return true;
          },
        },
        {
          name: 'isAvailable',
          type: 'checkbox',
          label: 'Disponibile',
          defaultValue: true,
        },
      ],
      admin: {
        description: 'Definisci gli orari per ogni giorno della settimana',
        components: {
          RowLabel: ({ data, index }) => {
            const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
            return data?.dayOfWeek !== undefined ? days[data.dayOfWeek] : `Orario ${index + 1}`;
          },
        },
      },
    },

    // Fees
    {
      name: 'consultationFee',
      type: 'number',
      required: true,
      label: 'Tariffa Visita (€)',
      min: 0,
      admin: {
        step: 5,
      },
    },
    {
      name: 'emergencyFee',
      type: 'number',
      required: true,
      label: 'Tariffa Urgenza (€)',
      min: 0,
      admin: {
        step: 5,
      },
    },
    {
      name: 'telemedicineFee',
      type: 'number',
      required: true,
      label: 'Tariffa Telemedicina (€)',
      min: 0,
      admin: {
        step: 5,
      },
    },

    // Status & Verification
    {
      name: 'isVerified',
      type: 'checkbox',
      label: 'Verificato',
      defaultValue: false,
      access: {
        create: isAdmin,
        update: isAdmin,
      },
      admin: {
        description: 'Veterinario verificato dallo staff',
      },
    },
    {
      name: 'isAcceptingPatients',
      type: 'checkbox',
      label: 'Accetta Nuovi Pazienti',
      defaultValue: true,
    },

    // Ratings & Reviews
    {
      name: 'rating',
      type: 'number',
      label: 'Valutazione Media',
      min: 0,
      max: 5,
      admin: {
        step: 0.1,
        readOnly: true,
        description: 'Calcolata automaticamente dalle recensioni',
      },
      access: {
        create: () => false,
        update: isAdmin,
      },
    },
    {
      name: 'totalReviews',
      type: 'number',
      label: 'Numero Recensioni',
      min: 0,
      defaultValue: 0,
      admin: {
        readOnly: true,
      },
      access: {
        create: () => false,
        update: isAdmin,
      },
    },

    // Additional Info
    {
      name: 'bio',
      type: 'richText',
      label: 'Biografia',
      admin: {
        description: 'Descrizione professionale del veterinario',
      },
    },
    {
      name: 'languages',
      type: 'select',
      hasMany: true,
      label: 'Lingue Parlate',
      options: [
        { label: 'Italiano', value: 'it' },
        { label: 'English', value: 'en' },
        { label: 'Français', value: 'fr' },
        { label: 'Deutsch', value: 'de' },
        { label: 'Español', value: 'es' },
      ],
      defaultValue: ['it'],
    },
    {
      name: 'servicesOffered',
      type: 'select',
      hasMany: true,
      label: 'Servizi Offerti',
      options: [
        { label: 'Visite a domicilio', value: 'home_visits' },
        { label: 'Telemedicina', value: 'telemedicine' },
        { label: 'Emergenze 24/7', value: 'emergency_24_7' },
        { label: 'Chirurgia', value: 'surgery' },
        { label: 'Diagnostica per immagini', value: 'imaging' },
        { label: 'Laboratorio', value: 'laboratory' },
        { label: 'Ricovero', value: 'hospitalization' },
        { label: 'Toelettatura', value: 'grooming' },
        { label: 'Vaccinazioni', value: 'vaccinations' },
        { label: 'Microchip', value: 'microchipping' },
      ],
    },

    // Contact & Social
    {
      name: 'contactInfo',
      type: 'group',
      label: 'Informazioni Contatto',
      fields: [
        {
          name: 'phone',
          type: 'text',
          label: 'Telefono Clinica',
          validate: (val) => {
            if (val && !/^\+?[1-9]\d{1,14}$/.test(val)) {
              return 'Numero di telefono non valido';
            }
            return true;
          },
        },
        {
          name: 'email',
          type: 'email',
          label: 'Email Clinica',
        },
        {
          name: 'website',
          type: 'text',
          label: 'Sito Web',
          validate: (val) => {
            if (val && !/^https?:\/\/.+\..+/.test(val)) {
              return 'URL non valido';
            }
            return true;
          },
        },
        {
          name: 'socialMedia',
          type: 'group',
          label: 'Social Media',
          fields: [
            {
              name: 'facebook',
              type: 'text',
              label: 'Facebook',
            },
            {
              name: 'instagram',
              type: 'text',
              label: 'Instagram',
            },
            {
              name: 'linkedin',
              type: 'text',
              label: 'LinkedIn',
            },
          ],
        },
      ],
    },

    // Statistics (Read-only)
    {
      name: 'statistics',
      type: 'group',
      label: 'Statistiche',
      admin: {
        readOnly: true,
        description: 'Aggiornate automaticamente',
      },
      access: {
        create: () => false,
        update: isAdmin,
      },
      fields: [
        {
          name: 'totalBookings',
          type: 'number',
          label: 'Prenotazioni Totali',
          defaultValue: 0,
        },
        {
          name: 'completedBookings',
          type: 'number',
          label: 'Visite Completate',
          defaultValue: 0,
        },
        {
          name: 'averageResponseTime',
          type: 'number',
          label: 'Tempo Risposta Medio (minuti)',
          defaultValue: 0,
        },
        {
          name: 'patientRetentionRate',
          type: 'number',
          label: 'Tasso di Fidelizzazione (%)',
          defaultValue: 0,
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      // Validate license number format
      async ({ req, operation, data }) => {
        if (data.licenseNumber && operation === 'create') {
          const existing = await req.payload.find({
            collection: 'veterinarians',
            where: {
              licenseNumber: { equals: data.licenseNumber },
            },
            limit: 1,
          });

          if (existing.docs.length > 0) {
            throw new Error('Numero albo già esistente');
          }
        }
        return data;
      },
      // Auto-generate coordinates if address is provided
      async ({ data }) => {
        if (data.clinicAddress && !data.clinicAddress.coordinates) {
          // TODO: Implement geocoding
          console.log(`Should geocode address: ${data.clinicAddress.street}, ${data.clinicAddress.city}`);
        }
        return data;
      },
    ],
    afterChange: [
      // Send verification notification
      async ({ req, operation, doc, previousDoc }) => {
        if (operation === 'update' && !previousDoc.isVerified && doc.isVerified) {
          // TODO: Send verification notification
          console.log(`Verification notification should be sent to veterinarian ${doc.user}`);
        }
      },
    ],
  },
  endpoints: [
    {
      path: '/search',
      method: 'get',
      handler: async (req, res) => {
        const { 
          location, 
          radius = 50, 
          specializations, 
          availableDate,
          minRating = 0,
          maxFee,
          telemedicine
        } = req.query;

        let where: any = {
          isVerified: { equals: true },
          isAcceptingPatients: { equals: true },
        };

        // Filter by specializations
        if (specializations) {
          const specs = Array.isArray(specializations) ? specializations : [specializations];
          where.specializations = { in: specs };
        }

        // Filter by rating
        if (minRating) {
          where.rating = { greater_than_equal: Number(minRating) };
        }

        // Filter by consultation fee
        if (maxFee) {
          where.consultationFee = { less_than_equal: Number(maxFee) };
        }

        // Filter by telemedicine availability
        if (telemedicine === 'true') {
          where.servicesOffered = { in: ['telemedicine'] };
        }

        const veterinarians = await req.payload.find({
          collection: 'veterinarians',
          where,
          populate: ['user'],
          limit: parseInt(req.query.limit as string) || 20,
          page: parseInt(req.query.page as string) || 1,
          sort: '-rating',
        });

        // Filter by location if provided
        if (location && typeof location === 'string') {
          const [lat, lng] = location.split(',').map(Number);
          if (lat && lng) {
            const { GeoUtils } = await import('@doggo/utils');
            const filteredVets = veterinarians.docs
              .map(vet => {
                if (!vet.clinicAddress?.coordinates) return null;
                const distance = GeoUtils.calculateDistance(
                  { latitude: lat, longitude: lng },
                  vet.clinicAddress.coordinates
                );
                return distance <= Number(radius) ? { ...vet, distance } : null;
              })
              .filter(Boolean)
              .sort((a, b) => a.distance - b.distance);

            return res.json({ ...veterinarians, docs: filteredVets });
          }
        }

        return res.json(veterinarians);
      },
    },
    {
      path: '/:id/availability',
      method: 'get',
      handler: async (req, res) => {
        const { id } = req.params;
        const { date } = req.query;

        if (!date) {
          return res.status(400).json({ error: 'Date parameter required' });
        }

        const veterinarian = await req.payload.findByID({
          collection: 'veterinarians',
          id,
        });

        if (!veterinarian) {
          return res.status(404).json({ error: 'Veterinarian not found' });
        }

        // Get available time slots
        const { db } = await import('@doggo/database');
        const availableSlots = await db.getVeterinarianAvailability(id, new Date(date as string));

        return res.json({
          date,
          availableSlots,
          workingHours: veterinarian.workingHours,
        });
      },
    },
    {
      path: '/:id/reviews',
      method: 'get',
      handler: async (req, res) => {
        const { id } = req.params;
        
        // TODO: Implement reviews system
        // For now, return mock data
        const mockReviews = [
          {
            id: '1',
            user: { firstName: 'Mario', lastName: 'R.' },
            rating: 5,
            comment: 'Eccellente veterinario, molto professionale e attento.',
            date: new Date().toISOString(),
            dogName: 'Max'
          },
          {
            id: '2',
            user: { firstName: 'Laura', lastName: 'B.' },
            rating: 4,
            comment: 'Buona esperienza, consigliato.',
            date: new Date(Date.now() - 86400000).toISOString(),
            dogName: 'Bella'
          }
        ];

        return res.json({
          reviews: mockReviews,
          totalReviews: mockReviews.length,
          averageRating: mockReviews.reduce((acc, r) => acc + r.rating, 0) / mockReviews.length,
        });
      },
    },
    {
      path: '/:id/dashboard',
      method: 'get',
      handler: async (req, res) => {
        const { id } = req.params;

        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        // Check if user owns this veterinarian profile
        const veterinarian = await req.payload.findByID({
          collection: 'veterinarians',
          id,
        });

        if (req.user.role !== 'admin' && veterinarian.user !== req.user.id) {
          return res.status(403).json({ error: 'Not authorized' });
        }

        // Get dashboard data
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [todayBookings, monthlyBookings, totalBookings, revenue] = await Promise.all([
          req.payload.find({
            collection: 'bookings',
            where: {
              veterinarian: { equals: id },
              scheduledAt: {
                greater_than_equal: new Date().toISOString().split('T')[0],
                less_than: new Date(Date.now() + 86400000).toISOString().split('T')[0],
              },
            },
            populate: ['user', 'dog'],
            sort: 'scheduledAt',
          }),
          req.payload.find({
            collection: 'bookings',
            where: {
              veterinarian: { equals: id },
              scheduledAt: { greater_than_equal: startOfMonth.toISOString() },
            },
          }),
          req.payload.find({
            collection: 'bookings',
            where: { veterinarian: { equals: id } },
          }),
          req.payload.find({
            collection: 'bookings',
            where: {
              veterinarian: { equals: id },
              paymentStatus: { equals: 'paid' },
            },
          }),
        ]);

        const totalRevenue = revenue.docs.reduce((sum, booking) => sum + booking.totalCost, 0);

        return res.json({
          todayBookings: todayBookings.docs,
          stats: {
            todayBookings: todayBookings.totalDocs,
            monthlyBookings: monthlyBookings.totalDocs,
            totalBookings: totalBookings.totalDocs,
            totalRevenue,
          },
        });
      },
    },
  ],
}; '