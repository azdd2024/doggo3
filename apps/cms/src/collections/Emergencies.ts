import type { CollectionConfig } from 'payload/types';
import { isAdmin, isEmergencyReporterOrAdmin } from '../access/index';

export const Emergencies: CollectionConfig = {
  slug: 'emergencies',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'reporter', 'priority', 'isResolved', 'createdAt'],
    group: 'Emergency',
  },
  access: {
    create: ({ req: { user } }) => !!user,
    read: ({ req: { user } }) => {
      if (!user) return { isResolved: { equals: true } }; // Only resolved emergencies for guests
      if (user.role === 'admin') return true;
      
      return {
        or: [
          { reporter: { equals: user.id } },
          { isResolved: { equals: true } },
          { priority: { in: ['high', 'critical'] } },
        ],
      };
    },
    update: isEmergencyReporterOrAdmin,
    delete: isAdmin,
    admin: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'reporter',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      label: 'Segnalatore',
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
    {
      name: 'type',
      type: 'select',
      required: true,
      label: 'Tipo Emergenza',
      options: [
        {
          label: '🔍 Cane Smarrito',
          value: 'lost_dog',
        },
        {
          label: '🎯 Cane Trovato',
          value: 'found_dog',
        },
        {
          label: '🚑 Cane Ferito',
          value: 'injured_dog',
        },
        {
          label: '💔 Cane Abbandonato',
          value: 'abandoned_dog',
        },
      ],
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Titolo',
      maxLength: 200,
      admin: {
        placeholder: 'Breve descrizione dell\'emergenza...',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
      label: 'Descrizione',
      maxLength: 2000,
      admin: {
        rows: 4,
        placeholder: 'Descrizione dettagliata dell\'emergenza, circostanze, comportamento del cane...',
      },
    },
    {
      name: 'location',
      type: 'group',
      label: 'Posizione',
      fields: [
        {
          name: 'address',
          type: 'text',
          required: true,
          label: 'Indirizzo',
          admin: {
            placeholder: 'Via Roma 123, Milano',
          },
        },
        {
          name: 'coordinates',
          type: 'group',
          label: 'Coordinate GPS',
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
    {
      name: 'dogInfo',
      type: 'group',
      label: 'Informazioni Cane',
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Nome',
          admin: {
            placeholder: 'Se conosciuto',
          },
        },
        {
          name: 'breed',
          type: 'text',
          label: 'Razza',
          admin: {
            placeholder: 'Es. Labrador, Meticcio...',
          },
        },
        {
          name: 'color',
          type: 'text',
          label: 'Colore',
          admin: {
            placeholder: 'Es. Nero, Bianco, Marrone...',
          },
        },
        {
          name: 'size',
          type: 'select',
          label: 'Taglia',
          options: [
            { label: 'Toy/Piccola', value: 'TINY' },
            { label: 'Piccola', value: 'SMALL' },
            { label: 'Media', value: 'MEDIUM' },
            { label: 'Grande', value: 'LARGE' },
            { label: 'Gigante', value: 'GIANT' },
          ],
        },
        {
          name: 'gender',
          type: 'select',
          label: 'Sesso',
          options: [
            { label: 'Maschio', value: 'maschio' },
            { label: 'Femmina', value: 'femmina' },
          ],
        },
        {
          name: 'age',
          type: 'number',
          label: 'Età (anni)',
          min: 0,
          max: 30,
        },
        {
          name: 'microchipNumber',
          type: 'text',
          label: 'Numero Microchip',
          validate: (val) => {
            if (val && !/^\d{15}$/.test(val)) {
              return 'Il numero microchip deve essere di 15 cifre';
            }
            return true;
          },
        },
        {
          name: 'distinguishingFeatures',
          type: 'textarea',
          label: 'Caratteristiche Distintive',
          admin: {
            rows: 2,
            placeholder: 'Cicatrici, collare particolare, comportamenti specifici...',
          },
        },
      ],
    },
    {
      name: 'photos',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      label: 'Foto',
      required: true,
      admin: {
        description: 'Carica almeno una foto del cane',
      },
    },
    {
      name: 'contactInfo',
      type: 'group',
      label: 'Informazioni Contatto',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          label: 'Nome Contatto',
        },
        {
          name: 'phone',
          type: 'text',
          required: true,
          label: 'Telefono',
          validate: (val) => {
            if (!/^\+?[1-9]\d{1,14}$/.test(val)) {
              return 'Numero di telefono non valido';
            }
            return true;
          },
        },
        {
          name: 'preferredContactMethod',
          type: 'select',
          required: true,
          label: 'Metodo Contatto Preferito',
          options: [
            { label: 'Telefono', value: 'phone' },
            { label: 'Email', value: 'email' },
            { label: 'Entrambi', value: 'both' },
          ],
          defaultValue: 'phone',
        },
      ],
    },
    {
      name: 'priority',
      type: 'select',
      required: true,
      label: 'Priorità',
      options: [
        {
          label: '🟢 Bassa',
          value: 'low',
        },
        {
          label: '🟡 Media',
          value: 'medium',
        },
        {
          label: '🟠 Alta',
          value: 'high',
        },
        {
          label: '🔴 Critica',
          value: 'critical',
        },
      ],
      defaultValue: 'medium',
      admin: {
        description: 'Livello di urgenza dell\'emergenza',
      },
    },
    {
      name: 'isResolved',
      type: 'checkbox',
      label: 'Risolto',
      defaultValue: false,
      admin: {
        description: 'Segna come risolto quando l\'emergenza è stata gestita',
      },
    },
    {
      name: 'resolvedAt',
      type: 'date',
      label: 'Risolto il',
      admin: {
        condition: (data) => data?.isResolved === true,
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'resolvedBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Risolto da',
      admin: {
        condition: (data) => data?.isResolved === true,
      },
    },
    {
      name: 'resolutionNotes',
      type: 'textarea',
      label: 'Note Risoluzione',
      admin: {
        condition: (data) => data?.isResolved === true,
        rows: 3,
        description: 'Descrivi come è stata risolta l\'emergenza',
      },
    },
    {
      name: 'viewCount',
      type: 'number',
      label: 'Visualizzazioni',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'Numero di volte che l\'emergenza è stata visualizzata',
      },
    },
    {
      name: 'helpOffers',
      type: 'array',
      label: 'Offerte di Aiuto',
      admin: {
        readOnly: true,
        description: 'Utenti che hanno offerto aiuto',
      },
      fields: [
        {
          name: 'user',
          type: 'relationship',
          relationTo: 'users',
          required: true,
        },
        {
          name: 'message',
          type: 'text',
          label: 'Messaggio',
        },
        {
          name: 'phone',
          type: 'text',
          label: 'Telefono Contatto',
        },
        {
          name: 'offeredAt',
          type: 'date',
          label: 'Offerto il',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      // Auto-resolve old emergencies
      async ({ data, operation }) => {
        if (operation === 'create') {
          data.viewCount = 0;
        }
        return data;
      },
      // Set resolved timestamp
      async ({ data, originalDoc }) => {
        if (data.isResolved && !originalDoc?.isResolved) {
          data.resolvedAt = new Date();
        }
        return data;
      },
    ],
    afterChange: [
      // Send emergency alerts to nearby users
      async ({ req, operation, doc }) => {
        if (operation === 'create' && !doc.isResolved) {
          try {
            const notificationService = req.app?.locals?.services?.notification;
            if (!notificationService) return;

            // Find nearby users
            const nearbyUsers = await req.payload.find({
              collection: 'users',
              where: {
                isActive: { equals: true },
                'preferences.notifications.push': { equals: true },
              },
              limit: 100,
            });

            // Send alerts in background
            nearbyUsers.docs.forEach(async (user: any) => {
              try {
                if (user.address?.coordinates && user.id !== doc.reporter) {
                  const { GeoUtils } = await import('@doggo/utils');
                  const distance = GeoUtils.calculateDistance(
                    doc.location.coordinates,
                    user.address.coordinates
                  );

                  if (distance <= 25) { // 25km radius
                    await notificationService.sendEmergencyAlert(user, doc, distance);
                  }
                }
              } catch (error) {
                payload.logger.warn('Failed to send emergency alert:', error);
              }
            });
          } catch (error) {
            payload.logger.error('Emergency alert processing error:', error);
          }
        }
      },
    ],
  },
  endpoints: [
    {
      path: '/nearby',
      method: 'get',
      handler: async (req, res) => {
        const { latitude, longitude, radius = 25, limit = 20 } = req.query;

        if (!latitude || !longitude) {
          return res.status(400).json({
            success: false,
            error: 'Latitude and longitude required',
          });
        }

        try {
          // Get all active emergencies
          const emergencies = await req.payload.find({
            collection: 'emergencies',
            where: {
              isResolved: { equals: false },
            },
            populate: ['reporter', 'photos'],
            limit: Number(limit) * 2,
            sort: '-createdAt',
          });

          // Filter by distance
          const { GeoUtils } = await import('@doggo/utils');
          const nearbyEmergencies = emergencies.docs
            .map((emergency: any) => {
              if (!emergency.location?.coordinates) return null;
              const distance = GeoUtils.calculateDistance(
                { latitude: Number(latitude), longitude: Number(longitude) },
                emergency.location.coordinates
              );
              return distance <= Number(radius) ? { ...emergency, distance } : null;
            })
            .filter(Boolean)
            .sort((a: any, b: any) => a.distance - b.distance)
            .slice(0, Number(limit));

          res.json({
            success: true,
            emergencies: nearbyEmergencies,
          });
        } catch (error) {
          payload.logger.error('Nearby emergencies error:', error);
          res.status(500).json({
            success: false,
            error: 'Failed to fetch nearby emergencies',
          });
        }
      },
    },
    {
      path: '/:id/help',
      method: 'post',
      handler: async (req, res) => {
        const { id } = req.params;
        const { message, phone } = req.body;

        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
          });
        }

        try {
          const emergency = await req.payload.findByID({
            collection: 'emergencies',
            id,
          });

          if (!emergency) {
            return res.status(404).json({
              success: false,
              error: 'Emergency not found',
            });
          }

          if (emergency.isResolved) {
            return res.status(400).json({
              success: false,
              error: 'Emergency already resolved',
            });
          }

          // Add help offer
          const helpOffers = Array.isArray(emergency.helpOffers) ? emergency.helpOffers : [];
          
          // Check if user already offered help
          const existingOffer = helpOffers.find((offer: any) => offer.user === req.user.id);
          if (existingOffer) {
            return res.status(400).json({
              success: false,
              error: 'You have already offered help for this emergency',
            });
          }

          helpOffers.push({
            user: req.user.id,
            message: message || 'Disponibile ad aiutare',
            phone: phone || req.user.phone,
            offeredAt: new Date(),
          });

          await req.payload.update({
            collection: 'emergencies',
            id,
            data: { helpOffers },
          });

          // Notify emergency reporter
          const notificationService = req.app?.locals?.services?.notification;
          if (notificationService) {
            await notificationService.sendNotification(
              emergency.reporter,
              'help_offered',
              'Aiuto Offerto',
              `${req.user.firstName} ha offerto aiuto per la tua emergenza`,
              {
                emergencyId: id,
                helperId: req.user.id,
              }
            );
          }

          res.json({
            success: true,
            message: 'Help offer submitted successfully',
          });
        } catch (error) {
          payload.logger.error('Help offer error:', error);
          res.status(500).json({
            success: false,
            error: 'Failed to submit help offer',
          });
        }
      },
    },
    {
      path: '/:id/resolve',
      method: 'patch',
      handler: async (req, res) => {
        const { id } = req.params;
        const { notes } = req.body;

        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
          });
        }

        try {
          const emergency = await req.payload.findByID({
            collection: 'emergencies',
            id,
          });

          if (!emergency) {
            return res.status(404).json({
              success: false,
              error: 'Emergency not found',
            });
          }

          // Check if user can resolve this emergency
          if (req.user.role !== 'admin' && emergency.reporter !== req.user.id) {
            return res.status(403).json({
              success: false,
              error: 'Only the reporter or admin can resolve this emergency',
            });
          }

          if (emergency.isResolved) {
            return res.status(400).json({
              success: false,
              error: 'Emergency already resolved',
            });
          }

          await req.payload.update({
            collection: 'emergencies',
            id,
            data: {
              isResolved: true,
              resolvedAt: new Date(),
              resolvedBy: req.user.id,
              resolutionNotes: notes,
            },
          });

          res.json({
            success: true,
            message: 'Emergency marked as resolved',
          });
        } catch (error) {
          payload.logger.error('Emergency resolution error:', error);
          res.status(500).json({
            success: false,
            error: 'Failed to resolve emergency',
          });
        }
      },
    },
    {
      path: '/:id/view',
      method: 'post',
      handler: async (req, res) => {
        const { id } = req.params;

        try {
          // Increment view count
          const emergency = await req.payload.findByID({
            collection: 'emergencies',
            id,
          });

          if (emergency) {
            await req.payload.update({
              collection: 'emergencies',
              id,
              data: {
                viewCount: (emergency.viewCount || 0) + 1,
              },
            });
          }

          res.json({ success: true });
        } catch (error) {
          // Don't fail the request for view count errors
          res.json({ success: true });
        }
      },
    },
  ],
};