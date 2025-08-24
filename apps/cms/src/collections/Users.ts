import type { CollectionConfig } from 'payload/types';
import { isAdmin, isAdminOrSelf } from '../access/index';

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['firstName', 'lastName', 'email', 'role', 'isVerified'],
    group: 'Core',
  },
  auth: {
    tokenExpiration: 7200, // 2 hours
    verify: {
      generateEmailHTML: ({ token, user }) => {
        const url = `${process.env.PAYLOAD_PUBLIC_SERVER_URL}/verify?token=${token}`;
        return `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #3B82F6;">Benvenuto su Doggo!</h1>
            <p>Ciao ${user.firstName},</p>
            <p>Grazie per esserti registrato su Doggo. Clicca sul pulsante qui sotto per verificare il tuo account:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${url}" style="background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Verifica Account
              </a>
            </div>
            <p>Se non riesci a cliccare il pulsante, copia e incolla questo link nel tuo browser:</p>
            <p style="word-break: break-all; color: #6B7280;">${url}</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">
            <p style="color: #6B7280; font-size: 14px;">
              Se non hai creato un account su Doggo, puoi ignorare questa email.
            </p>
          </div>
        `;
      },
    },
    forgotPassword: {
      generateEmailHTML: ({ token, user }) => {
        const url = `${process.env.PAYLOAD_PUBLIC_SERVER_URL}/reset-password?token=${token}`;
        return `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #3B82F6;">Reset Password - Doggo</h1>
            <p>Ciao ${user.firstName},</p>
            <p>Hai richiesto di reimpostare la tua password. Clicca sul pulsante qui sotto:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${url}" style="background: #EF4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reimposta Password
              </a>
            </div>
            <p>Questo link scadrà tra 1 ora per motivi di sicurezza.</p>
            <p>Se non hai richiesto il reset della password, puoi ignorare questa email.</p>
          </div>
        `;
      },
    },
  },
  access: {
    create: () => true, // Anyone can register
    read: isAdminOrSelf,
    update: isAdminOrSelf,
    delete: isAdmin,
    admin: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    // Basic Info
    {
      name: 'firstName',
      type: 'text',
      required: true,
      label: 'Nome',
      admin: {
        placeholder: 'Mario',
      },
    },
    {
      name: 'lastName',
      type: 'text',
      required: true,
      label: 'Cognome',
      admin: {
        placeholder: 'Rossi',
      },
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Telefono',
      admin: {
        placeholder: '+39 123 456 7890',
      },
      validate: (val) => {
        if (val && !/^\+?[1-9]\d{1,14}$/.test(val)) {
          return 'Numero di telefono non valido';
        }
        return true;
      },
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      label: 'Avatar',
      admin: {
        description: 'Foto profilo (opzionale)',
      },
    },

    // Role & Status
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'user',
      options: [
        {
          label: 'Utente',
          value: 'user',
        },
        {
          label: 'Veterinario',
          value: 'veterinarian',
        },
        {
          label: 'Canile/Associazione',
          value: 'shelter',
        },
        {
          label: 'Amministratore',
          value: 'admin',
        },
      ],
      access: {
        create: isAdmin,
        update: isAdmin,
      },
    },
    {
      name: 'isVerified',
      type: 'checkbox',
      label: 'Account Verificato',
      defaultValue: false,
      access: {
        create: isAdmin,
        update: isAdmin,
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      label: 'Account Attivo',
      defaultValue: true,
      access: {
        create: isAdmin,
        update: isAdmin,
      },
    },

    // Address
    {
      name: 'address',
      type: 'group',
      label: 'Indirizzo',
      fields: [
        {
          name: 'street',
          type: 'text',
          label: 'Via/Piazza',
          admin: {
            placeholder: 'Via Roma 123',
          },
        },
        {
          name: 'city',
          type: 'text',
          label: 'Città',
          admin: {
            placeholder: 'Roma',
          },
        },
        {
          name: 'state',
          type: 'text',
          label: 'Regione',
          admin: {
            placeholder: 'Lazio',
          },
        },
        {
          name: 'zipCode',
          type: 'text',
          label: 'CAP',
          admin: {
            placeholder: '00100',
          },
          validate: (val) => {
            if (val && !/^\d{5}$/.test(val)) {
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
          label: 'Coordinate',
          fields: [
            {
              name: 'latitude',
              type: 'number',
              label: 'Latitudine',
              admin: {
                step: 0.000001,
              },
            },
            {
              name: 'longitude',
              type: 'number',
              label: 'Longitudine',
              admin: {
                step: 0.000001,
              },
            },
          ],
        },
      ],
    },

    // Preferences
    {
      name: 'preferences',
      type: 'group',
      label: 'Preferenze',
      fields: [
        {
          name: 'language',
          type: 'select',
          label: 'Lingua',
          defaultValue: 'it',
          options: [
            {
              label: 'Italiano',
              value: 'it',
            },
            {
              label: 'English',
              value: 'en',
            },
          ],
        },
        {
          name: 'notifications',
          type: 'group',
          label: 'Notifiche',
          fields: [
            {
              name: 'email',
              type: 'checkbox',
              label: 'Email',
              defaultValue: true,
            },
            {
              name: 'sms',
              type: 'checkbox',
              label: 'SMS',
              defaultValue: false,
            },
            {
              name: 'push',
              type: 'checkbox',
              label: 'Push',
              defaultValue: true,
            },
          ],
        },
        {
          name: 'privacy',
          type: 'group',
          label: 'Privacy',
          fields: [
            {
              name: 'showProfile',
              type: 'checkbox',
              label: 'Profilo Pubblico',
              defaultValue: true,
            },
            {
              name: 'showLocation',
              type: 'checkbox',
              label: 'Mostra Posizione',
              defaultValue: false,
            },
            {
              name: 'allowMatching',
              type: 'checkbox',
              label: 'Abilita Matching',
              defaultValue: true,
            },
          ],
        },
      ],
    },

    // Metadata
    {
      name: 'lastLogin',
      type: 'date',
      label: 'Ultimo Accesso',
      admin: {
        readOnly: true,
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
      access: {
        create: () => false,
        update: isAdmin,
      },
    },
    {
      name: 'loginCount',
      type: 'number',
      label: 'Numero Accessi',
      defaultValue: 0,
      admin: {
        readOnly: true,
      },
      access: {
        create: () => false,
        update: isAdmin,
      },
    },
  ],
  hooks: {
    beforeChange: [
      // Hash password if provided
      async ({ req, operation, data }) => {
        if (operation === 'create' || (operation === 'update' && data.password)) {
          const { CryptoUtils } = await import('@doggo/utils');
          if (data.password) {
            data.password = await CryptoUtils.hashPassword(data.password);
          }
        }
        return data;
      },
      // Update login metadata
      async ({ req, operation, data, originalDoc }) => {
        if (operation === 'update' && req.user && req.user.id === originalDoc.id) {
          data.lastLogin = new Date();
          data.loginCount = (originalDoc.loginCount || 0) + 1;
        }
        return data;
      },
    ],
    afterChange: [
      // Send welcome email
      async ({ req, operation, doc, previousDoc }) => {
        if (operation === 'create') {
          // TODO: Send welcome email
          console.log(`Welcome email should be sent to ${doc.email}`);
        }
        
        // Send verification status change email
        if (operation === 'update' && !previousDoc.isVerified && doc.isVerified) {
          // TODO: Send verification confirmation email
          console.log(`Verification confirmation email should be sent to ${doc.email}`);
        }
      },
    ],
  },
  endpoints: [
    {
      path: '/profile',
      method: 'get',
      handler: async (req, res) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const user = await req.payload.findByID({
          collection: 'users',
          id: req.user.id,
        });

        return res.json({ user });
      },
    },
    {
      path: '/update-location',
      method: 'patch',
      handler: async (req, res) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
          return res.status(400).json({ error: 'Latitude and longitude required' });
        }

        await req.payload.update({
          collection: 'users',
          id: req.user.id,
          data: {
            'address.coordinates.latitude': latitude,
            'address.coordinates.longitude': longitude,
          },
        });

        return res.json({ success: true });
      },
    },
  ],
};