import type { GlobalConfig } from 'payload/types';
import { isAdmin } from '../access/index';

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Impostazioni Sito',
  admin: {
    group: 'System',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      name: 'siteName',
      type: 'text',
      required: true,
      label: 'Nome Sito',
      defaultValue: 'Doggo Platform',
    },
    {
      name: 'siteDescription',
      type: 'textarea',
      required: true,
      label: 'Descrizione Sito',
      defaultValue: 'La piattaforma completa per cani, proprietari, veterinari e associazioni',
      admin: {
        rows: 3,
      },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      label: 'Logo',
    },
    {
      name: 'favicon',
      type: 'upload',
      relationTo: 'media',
      label: 'Favicon',
    },
    {
      name: 'contactInfo',
      type: 'group',
      label: 'Informazioni Contatto',
      fields: [
        {
          name: 'contactEmail',
          type: 'email',
          required: true,
          label: 'Email Contatto',
          defaultValue: 'info@doggo.com',
        },
        {
          name: 'supportEmail',
          type: 'email',
          required: true,
          label: 'Email Supporto',
          defaultValue: 'support@doggo.com',
        },
        {
          name: 'emergencyPhone',
          type: 'text',
          required: true,
          label: 'Telefono Emergenze',
          defaultValue: '+39 02 1234567',
        },
        {
          name: 'address',
          type: 'group',
          label: 'Indirizzo Sede',
          fields: [
            {
              name: 'street',
              type: 'text',
              label: 'Via',
            },
            {
              name: 'city',
              type: 'text',
              label: 'Città',
            },
            {
              name: 'zipCode',
              type: 'text',
              label: 'CAP',
            },
            {
              name: 'country',
              type: 'text',
              label: 'Paese',
              defaultValue: 'Italia',
            },
          ],
        },
      ],
    },
    {
      name: 'socialMedia',
      type: 'group',
      label: 'Social Media',
      fields: [
        {
          name: 'facebook',
          type: 'text',
          label: 'Facebook URL',
        },
        {
          name: 'instagram',
          type: 'text',
          label: 'Instagram URL',
        },
        {
          name: 'twitter',
          type: 'text',
          label: 'Twitter URL',
        },
        {
          name: 'linkedin',
          type: 'text',
          label: 'LinkedIn URL',
        },
        {
          name: 'youtube',
          type: 'text',
          label: 'YouTube URL',
        },
      ],
    },
    {
      name: 'seo',
      type: 'group',
      label: 'SEO',
      fields: [
        {
          name: 'metaTitle',
          type: 'text',
          label: 'Meta Title',
          defaultValue: 'Doggo - Piattaforma per Cani e Proprietari',
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          label: 'Meta Description',
          defaultValue: 'La piattaforma completa per la salute e il benessere del tuo cane. Veterinari, adozioni, emergenze e social network per cani.',
          admin: {
            rows: 2,
          },
        },
        {
          name: 'ogImage',
          type: 'upload',
          relationTo: 'media',
          label: 'OG Image',
        },
        {
          name: 'keywords',
          type: 'textarea',
          label: 'Keywords SEO',
          defaultValue: 'cani, veterinario, adozioni, emergenze, social network, animali',
          admin: {
            description: 'Parole chiave separate da virgola',
          },
        },
      ],
    },
    {
      name: 'features',
      type: 'group',
      label: 'Funzionalità',
      fields: [
        {
          name: 'enableBookings',
          type: 'checkbox',
          label: 'Abilita Prenotazioni',
          defaultValue: true,
        },
        {
          name: 'enableTelemedicine',
          type: 'checkbox',
          label: 'Abilita Telemedicina',
          defaultValue: true,
        },
        {
          name: 'enableMatching',
          type: 'checkbox',
          label: 'Abilita Matching (TinDog)',
          defaultValue: true,
        },
        {
          name: 'enableEmergencies',
          type: 'checkbox',
          label: 'Abilita Emergenze',
          defaultValue: true,
        },
        {
          name: 'enableAdoptions',
          type: 'checkbox',
          label: 'Abilita Adozioni',
          defaultValue: true,
        },
        {
          name: 'enableDonations',
          type: 'checkbox',
          label: 'Abilita Donazioni',
          defaultValue: true,
        },
        {
          name: 'enableEvents',
          type: 'checkbox',
          label: 'Abilita Eventi',
          defaultValue: true,
        },
        {
          name: 'enablePrescriptions',
          type: 'checkbox',
          label: 'Abilita REV Digitale',
          defaultValue: true,
        },
      ],
    },
    {
      name: 'limits',
      type: 'group',
      label: 'Limiti Sistema',
      fields: [
        {
          name: 'maxDogsPerUser',
          type: 'number',
          label: 'Max Cani per Utente',
          defaultValue: 10,
          min: 1,
          max: 50,
        },
        {
          name: 'maxPhotosPerDog',
          type: 'number',
          label: 'Max Foto per Cane',
          defaultValue: 10,
          min: 1,
          max: 20,
        },
        {
          name: 'maxFileSize',
          type: 'number',
          label: 'Dimensione Max File (MB)',
          defaultValue: 10,
          min: 1,
          max: 100,
        },
        {
          name: 'bookingAdvanceDays',
          type: 'number',
          label: 'Giorni Anticipo Prenotazioni',
          defaultValue: 30,
          min: 1,
          max: 365,
        },
        {
          name: 'emergencyRadiusKm',
          type: 'number',
          label: 'Raggio Emergenze (km)',
          defaultValue: 25,
          min: 1,
          max: 100,
        },
      ],
    },
    {
      name: 'notifications',
      type: 'group',
      label: 'Notifiche',
      fields: [
        {
          name: 'enableEmailNotifications',
          type: 'checkbox',
          label: 'Abilita Email',
          defaultValue: true,
        },
        {
          name: 'enableSmsNotifications',
          type: 'checkbox',
          label: 'Abilita SMS',
          defaultValue: true,
        },
        {
          name: 'enablePushNotifications',
          type: 'checkbox',
          label: 'Abilita Push',
          defaultValue: true,
        },
        {
          name: 'emergencyAlertRadius',
          type: 'number',
          label: 'Raggio Alert Emergenze (km)',
          defaultValue: 25,
          min: 1,
          max: 100,
        },
      ],
    },
    {
      name: 'maintenanceMode',
      type: 'checkbox',
      label: 'Modalità Manutenzione',
      defaultValue: false,
      admin: {
        description: 'Attiva per disabilitare l\'accesso al sito (eccetto admin)',
      },
    },
    {
      name: 'maintenanceMessage',
      type: 'richText',
      label: 'Messaggio Manutenzione',
      admin: {
        condition: (data) => data?.maintenanceMode === true,
      },
    },
    {
      name: 'termsOfService',
      type: 'richText',
      label: 'Termini di Servizio',
    },
    {
      name: 'privacyPolicy',
      type: 'richText',
      label: 'Privacy Policy',
    },
    {
      name: 'cookiePolicy',
      type: 'richText',
      label: 'Cookie Policy',
    },
    {
      name: 'initialized',
      type: 'checkbox',
      label: 'Inizializzato',
      defaultValue: false,
      admin: {
        readOnly: true,
        description: 'Segna se le impostazioni sono state inizializzate',
      },
    },
  ],
  hooks: {
    afterChange: [
      // Invalidate cache when settings change
      async ({ req }) => {
        try {
          const redis = req.app?.locals?.redis;
          if (redis) {
            await redis.del('site_settings');
            payload.logger.info('Site settings cache invalidated');
          }
        } catch (error) {
          payload.logger.error('Failed to invalidate settings cache:', error);
        }
      },
    ],
  },
};