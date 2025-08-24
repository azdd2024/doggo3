import type { CollectionConfig } from 'payload/types';
import { isAdmin, isOwnerOrAdmin } from '../access/index';

export const Dogs: CollectionConfig = {
  slug: 'dogs',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'breed', 'owner', 'size', 'isActive'],
    group: 'Core',
  },
  access: {
    create: ({ req: { user } }) => !!user,
    read: ({ req: { user } }) => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      return {
        or: [
          { owner: { equals: user.id } },
          { 'owner.preferences.privacy.showProfile': { equals: true } },
        ],
      };
    },
    update: isOwnerOrAdmin,
    delete: isOwnerOrAdmin,
    admin: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    // Basic Info
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      label: 'Proprietario',
      admin: {
        condition: (_, siblingData, { user }) => user?.role === 'admin',
      },
      hooks: {
        beforeChange: [
          ({ req, value }) => {
            // Auto-assign owner if not admin
            if (req.user?.role !== 'admin') {
              return req.user.id;
            }
            return value;
          },
        ],
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Nome',
      admin: {
        placeholder: 'Max',
      },
    },
    {
      name: 'breed',
      type: 'text',
      required: true,
      label: 'Razza',
      admin: {
        placeholder: 'Labrador Retriever',
      },
    },
    {
      name: 'birthDate',
      type: 'date',
      required: true,
      label: 'Data di Nascita',
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },
    {
      name: 'gender',
      type: 'select',
      required: true,
      label: 'Sesso',
      options: [
        {
          label: 'Maschio',
          value: 'maschio',
        },
        {
          label: 'Femmina',
          value: 'femmina',
        },
      ],
    },

    // Physical Characteristics
    {
      name: 'size',
      type: 'select',
      required: true,
      label: 'Taglia',
      options: [
        {
          label: 'Toy (<5kg)',
          value: 'TINY',
        },
        {
          label: 'Piccola (5-15kg)',
          value: 'SMALL',
        },
        {
          label: 'Media (15-30kg)',
          value: 'MEDIUM',
        },
        {
          label: 'Grande (30-50kg)',
          value: 'LARGE',
        },
        {
          label: 'Gigante (>50kg)',
          value: 'GIANT',
        },
      ],
    },
    {
      name: 'weight',
      type: 'number',
      required: true,
      label: 'Peso (kg)',
      min: 0.5,
      max: 100,
      admin: {
        step: 0.1,
      },
    },
    {
      name: 'color',
      type: 'text',
      required: true,
      label: 'Colore',
      admin: {
        placeholder: 'Nero, Bianco, Marrone...',
      },
    },

    // Identification
    {
      name: 'microchipNumber',
      type: 'text',
      label: 'Numero Microchip',
      unique: true,
      admin: {
        placeholder: '380260123456789',
        description: 'Codice a 15 cifre del microchip ISO',
      },
      validate: (val) => {
        if (val && !/^\d{15}$/.test(val)) {
          return 'Il numero microchip deve essere di 15 cifre';
        }
        return true;
      },
    },

    // Health & Behavior
    {
      name: 'isNeutered',
      type: 'checkbox',
      label: 'Sterilizzato/Castrato',
      defaultValue: false,
    },
    {
      name: 'activityLevel',
      type: 'select',
      required: true,
      label: 'Livello di Attività',
      options: [
        {
          label: 'Basso - Preferisce riposare',
          value: 'LOW',
        },
        {
          label: 'Moderato - Passeggiate quotidiane',
          value: 'MODERATE',
        },
        {
          label: 'Alto - Molto energico',
          value: 'HIGH',
        },
        {
          label: 'Molto Alto - Cane sportivo',
          value: 'VERY_HIGH',
        },
      ],
    },
    {
      name: 'temperament',
      type: 'select',
      label: 'Carattere',
      hasMany: true,
      options: [
        { label: 'Amichevole', value: 'amichevole' },
        { label: 'Energico', value: 'energico' },
        { label: 'Calmo', value: 'calmo' },
        { label: 'Protettivo', value: 'protettivo' },
        { label: 'Giocoso', value: 'giocoso' },
        { label: 'Intelligente', value: 'intelligente' },
        { label: 'Leale', value: 'leale' },
        { label: 'Docile', value: 'docile' },
        { label: 'Coraggioso', value: 'coraggioso' },
        { label: 'Affettuoso', value: 'affettuoso' },
        { label: 'Indipendente', value: 'indipendente' },
        { label: 'Socievole', value: 'socievole' },
      ],
      admin: {
        description: 'Seleziona tutte le caratteristiche che descrivono il cane',
      },
    },

    // Medical Info
    {
      name: 'medicalNotes',
      type: 'textarea',
      label: 'Note Mediche',
      admin: {
        placeholder: 'Allergie, condizioni mediche, farmaci...',
        rows: 3,
      },
    },
    {
      name: 'dietaryNeeds',
      type: 'textarea',
      label: 'Esigenze Alimentari',
      admin: {
        placeholder: 'Dieta speciale, allergie alimentari...',
        rows: 2,
      },
    },

    // Media
    {
      name: 'photos',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      label: 'Foto',
      admin: {
        description: 'Carica foto del tuo cane (massimo 10)',
      },
      validate: (val) => {
        if (val && val.length > 10) {
          return 'Massimo 10 foto consentite';
        }
        return true;
      },
    },

    // Status
    {
      name: 'isActive',
      type: 'checkbox',
      label: 'Attivo',
      defaultValue: true,
      admin: {
        description: 'Disabilita se il cane non è più disponibile per servizi',
      },
    },

    // Computed Age Field
    {
      name: 'age',
      type: 'text',
      label: 'Età',
      admin: {
        readOnly: true,
        description: 'Calcolata automaticamente dalla data di nascita',
      },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            if (siblingData.birthDate) {
              const { DateUtils } = require('@doggo/utils');
              const age = DateUtils.calculateAge(new Date(siblingData.birthDate));
              if (age.years > 0) {
                return `${age.years} anni${age.months > 0 ? ` e ${age.months} mesi` : ''}`;
              }
              return `${age.months} mesi`;
            }
            return '';
          },
        ],
      },
    },
  ],
  hooks: {
    beforeChange: [
      // Validate microchip uniqueness across all dogs
      async ({ req, operation, data, originalDoc }) => {
        if (data.microchipNumber && operation === 'create') {
          const existing = await req.payload.find({
            collection: 'dogs',
            where: {
              microchipNumber: { equals: data.microchipNumber },
            },
            limit: 1,
          });

          if (existing.docs.length > 0) {
            throw new Error('Numero microchip già esistente');
          }
        }
        return data;
      },
    ],
    afterChange: [
      // Create initial health record
      async ({ req, operation, doc }) => {
        if (operation === 'create') {
          // TODO: Create initial health record
          console.log(`Initial health record should be created for dog ${doc.name}`);
        }
      },
    ],
  },
  endpoints: [
    {
      path: '/search',
      method: 'get',
      handler: async (req, res) => {
        const { breed, size, activityLevel, location, radius = 50 } = req.query;
        
        const where: any = { isActive: { equals: true } };

        if (breed) {
          where.breed = { contains: breed as string, mode: 'insensitive' };
        }

        if (size) {
          const sizes = Array.isArray(size) ? size : [size];
          where.size = { in: sizes };
        }

        if (activityLevel) {
          const levels = Array.isArray(activityLevel) ? activityLevel : [activityLevel];
          where.activityLevel = { in: levels };
        }

        const dogs = await req.payload.find({
          collection: 'dogs',
          where,
          populate: ['owner', 'photos'],
          limit: parseInt(req.query.limit as string) || 20,
          page: parseInt(req.query.page as string) || 1,
        });

        // Filter by location if provided
        if (location && typeof location === 'string') {
          const [lat, lng] = location.split(',').map(Number);
          if (lat && lng) {
            const { GeoUtils } = await import('@doggo/utils');
            const filteredDogs = dogs.docs.filter(dog => {
              if (!dog.owner?.address?.coordinates) return false;
              const distance = GeoUtils.calculateDistance(
                { latitude: lat, longitude: lng },
                dog.owner.address.coordinates
              );
              return distance <= Number(radius);
            });
            return res.json({ ...dogs, docs: filteredDogs });
          }
        }

        return res.json(dogs);
      },
    },
    {
      path: '/my-dogs',
      method: 'get',
      handler: async (req, res) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const dogs = await req.payload.find({
          collection: 'dogs',
          where: {
            owner: { equals: req.user.id },
          },
          populate: ['photos'],
          sort: '-createdAt',
        });

        return res.json(dogs);
      },
    },
    {
      path: '/:id/health-summary',
      method: 'get',
      handler: async (req, res) => {
        const { id } = req.params;
        
        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        // Check if user owns this dog or is admin
        const dog = await req.payload.findByID({
          collection: 'dogs',
          id,
        });

        if (req.user.role !== 'admin' && dog.owner !== req.user.id) {
          return res.status(403).json({ error: 'Not authorized' });
        }

        // Get health-related documents and bookings
        const [documents, bookings] = await Promise.all([
          req.payload.find({
            collection: 'documents',
            where: {
              dog: { equals: id },
              type: { in: ['vaccination', 'medical_record', 'prescription'] },
            },
            sort: '-createdAt',
            limit: 20,
          }),
          req.payload.find({
            collection: 'bookings',
            where: {
              dog: { equals: id },
              status: { equals: 'completed' },
            },
            populate: ['veterinarian'],
            sort: '-scheduledAt',
            limit: 10,
          }),
        ]);

        return res.json({
          dog,
          documents: documents.docs,
          recentVisits: bookings.docs,
          healthScore: Math.floor(Math.random() * 30) + 70, // Mock health score
        });
      },
    },
  ],
};