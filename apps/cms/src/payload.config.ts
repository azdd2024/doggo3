import { buildConfig } from 'payload/config';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { s3Storage } from '@payloadcms/storage-s3';
import path from 'path';

// Collections
import { Users } from './collections/Users';
import { Dogs } from './collections/Dogs';
import { Veterinarians } from './collections/Veterinarians';
import { Shelters } from './collections/Shelters';
import { Bookings } from './collections/Bookings';
import { Documents } from './collections/Documents';
import { Emergencies } from './collections/Emergencies';
import { Matches } from './collections/Matches';
import { Chats } from './collections/Chats';
import { Messages } from './collections/Messages';
import { Notifications } from './collections/Notifications';
import { Events } from './collections/Events';
import { Donations } from './collections/Donations';
import { Prescriptions } from './collections/Prescriptions';
import { Media } from './collections/Media';

// Globals
import { SiteSettings } from './globals/SiteSettings';
import { EmailTemplates } from './globals/EmailTemplates';

export default buildConfig({
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000',
  admin: {
    user: Users.slug,
    bundler: 'webpack',
    meta: {
      titleSuffix: '- Doggo Admin',
      favicon: '/favicon.ico',
      ogImage: '/og-image.jpg',
    },
    css: path.resolve(__dirname, 'styles/admin.css'),
    components: {
      // Custom admin components
      graphics: {
        Logo: path.resolve(__dirname, 'components/Logo'),
        Icon: path.resolve(__dirname, 'components/Icon'),
      },
    },
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  editor: lexicalEditor({}),
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    },
    migrationDir: path.resolve(__dirname, 'migrations'),
  }),
  collections: [
    Users,
    Dogs,
    Veterinarians,
    Shelters,
    Bookings,
    Documents,
    Emergencies,
    Matches,
    Chats,
    Messages,
    Notifications,
    Events,
    Donations,
    Prescriptions,
    Media,
  ],
  globals: [
    SiteSettings,
    EmailTemplates,
  ],
  plugins: [
    s3Storage({
      collections: {
        media: {
          prefix: 'media',
        },
        documents: {
          prefix: 'documents',
        },
      },
      bucket: process.env.S3_BUCKET_NAME!,
      config: {
        endpoint: process.env.S3_ENDPOINT,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID!,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        },
        region: process.env.S3_REGION || 'auto',
        forcePathStyle: true,
      },
    }),
  ],
  typescript: {
    outputFile: path.resolve(__dirname, 'payload-types.ts'),
  },
  graphQL: {
    schemaOutputFile: path.resolve(__dirname, 'generated-schema.graphql'),
    disable: false,
  },
  cors: [
    process.env.NEXTAUTH_URL || 'http://localhost:3001',
    'https://doggo.com',
  ],
  csrf: [
    process.env.NEXTAUTH_URL || 'http://localhost:3001',
    'https://doggo.com',
  ],
  rateLimit: {
    trustProxy: true,
    window: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
  },
  upload: {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
    imageSizes: [
      {
        name: 'thumbnail',
        width: 200,
        height: 200,
        position: 'center',
        crop: 'center',
      },
      {
        name: 'card',
        width: 400,
        height: 300,
        position: 'center',
        crop: 'center',
      },
      {
        name: 'feature',
        width: 1200,
        height: 630,
        position: 'center',
        crop: 'center',
      },
    ],
    formatOptions: {
      format: 'webp',
      options: {
        quality: 85,
      },
    },
  },
  localization: {
    locales: [
      {
        code: 'it',
        label: 'Italiano',
      },
      {
        code: 'en',
        label: 'English',
      },
    ],
    defaultLocale: 'it',
    fallback: true,
  },
  hooks: {
    beforeChange: [
      // Global audit logging
      async ({ req, operation, data, originalDoc }) => {
        if (req.user && operation !== 'read') {
          console.log(`User ${req.user.email} performing ${operation} operation`);
        }
      },
    ],
  },
  onInit: async (payload) => {
    // Create default admin user if none exists
    const adminUser = await payload.find({
      collection: 'users',
      where: {
        role: { equals: 'admin' },
      },
      limit: 1,
    });

    if (adminUser.docs.length === 0) {
      await payload.create({
        collection: 'users',
        data: {
          email: process.env.ADMIN_EMAIL || 'admin@doggo.com',
          password: process.env.ADMIN_PASSWORD || 'admin123',
          firstName: 'Admin',
          lastName: 'Doggo',
          role: 'admin',
          isVerified: true,
        },
      });
      console.log('✅ Default admin user created');
    }

    // Initialize system settings
    const settings = await payload.findGlobal({
      slug: 'site-settings',
    });

    if (!settings.initialized) {
      await payload.updateGlobal({
        slug: 'site-settings',
        data: {
          siteName: 'Doggo Platform',
          siteDescription: 'La piattaforma completa per cani, proprietari, veterinari e associazioni',
          contactEmail: 'info@doggo.com',
          supportEmail: 'support@doggo.com',
          emergencyPhone: '+39 02 1234567',
          maintenanceMode: false,
          initialized: true,
        },
      });
      console.log('✅ Site settings initialized');
    }
  },
  express: {
    compression: true,
    json: {
      limit: '50mb',
    },
    urlencoded: {
      limit: '50mb',
      extended: true,
    },
  },
  debug: process.env.NODE_ENV === 'development',
});