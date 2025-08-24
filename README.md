# 🐕 DOGGO Platform

**Ecosistema digitale completo per cani, proprietari, veterinari e associazioni**

Una piattaforma moderna e completa che connette proprietari di cani con veterinari, facilita adozioni, gestisce emergenze e crea una community per il benessere degli animali.

## 🚀 Funzionalità Principali

### 🏥 **Sistema Sanitario**
- **Booking Veterinario**: Prenotazioni con ricerca geo-localizzata e triage automatico
- **Telemedicina**: Videochiamate WebRTC integrate con Daily.co
- **REV Digitale**: Sistema di ricette elettroniche con firma digitale e QR code
- **Cartella Clinica**: Gestione completa documenti e storia medica

### 💖 **TinDog - Social Matching**
- **Algoritmo Intelligente**: Matching basato su compatibilità razza/età/carattere
- **Chat Real-time**: Comunicazione tra proprietari con media sharing
- **Organizzazione Incontri**: Pianificazione meetup per i cani

### 🚨 **Sistema Emergenze**
- **Segnalazioni Geo**: Cani smarriti/trovati con notifiche per raggio
- **Alert Real-time**: Notifiche push e SMS per emergenze nelle vicinanze
- **Network di Supporto**: Coinvolgimento della community locale

### 🏠 **Adozioni & Canili**
- **Gestione Adozioni**: Sistema completo per canili e associazioni
- **Profili Dettagliati**: Cani adottabili con storia e caratteristiche
- **Processo Trasparente**: Tracking completo delle richieste di adozione
- **Donazioni**: Sistema integrato per supportare le strutture

### 📊 **Dashboard B2B**
- **Admin Panel**: KPI, moderazione, gestione emergenze
- **Dashboard Veterinari**: Calendario, pazienti, analytics fatturato
- **Panel Canili**: Gestione cani, eventi, donazioni tracking

## 🛠 Stack Tecnologico

### Backend
- **CMS**: Payload CMS 3.0 con PostgreSQL + PostGIS
- **API**: REST + GraphQL + tRPC per Flutter
- **Real-time**: Socket.io + Server-Sent Events
- **Storage**: Cloudflare R2 + Minio (locale)
- **Queue**: Bull.js + Redis per job asincroni

### Frontend
- **Framework**: Next.js 15 + App Router
- **Styling**: Tailwind CSS + shadcn/ui + Tremor
- **Animations**: Framer Motion + Lottie
- **State**: tRPC + TanStack Query
- **Forms**: React Hook Form + Zod validation

### Integrazioni
- **Pagamenti**: Stripe completo (singoli + subscriptions)
- **Video**: Daily.co per telemedicina
- **Email**: SendGrid con template dinamici
- **SMS**: Twilio per notifiche urgenti  
- **Maps**: Mapbox per geolocalizzazione
- **Auth**: NextAuth.js multi-provider
- **Monitoring**: Sentry + PostHog analytics

## 🏗 Architettura

```
doggo/
├── apps/
│   ├── cms/                 # Backend Payload CMS
│   │   ├── src/
│   │   │   ├── collections/ # 15+ collections complete
│   │   │   ├── services/    # Email, SMS, Payment, Video
│   │   │   ├── hooks/       # Business logic
│   │   │   └── server.ts    # Main server + Socket.io
│   └── web/                 # Frontend Next.js
│       ├── app/            # App Router pages
│       ├── components/     # UI components
│       └── lib/           # Utils e client
├── packages/
│   ├── database/          # Prisma + utilities
│   ├── types/            # TypeScript condivisi
│   └── utils/           # Helper functions
└── docker-compose.yml   # Infrastruttura completa
```

## 🚀 Quick Start

### Prerequisiti
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL (via Docker)
- Redis (via Docker)

### 1. Clone e Setup
```bash
git clone <repo-url> doggo
cd doggo

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Configura le variabili in .env
```

### 2. Avvia Infrastruttura
```bash
# Start database, Redis, Minio
docker-compose up -d

# Setup database
npm run db:generate
npm run db:push
npm run db:seed
```

### 3. Start Development
```bash
# Start all services
npm run dev

# Or individually:
npm run dev:cms    # Backend (localhost:3000)
npm run dev:web    # Frontend (localhost:3001)
```

### 4. Accesso
- **Frontend**: http://localhost:3001
- **Admin Panel**: http://localhost:3000/admin
- **API**: http://localhost:3000/api
- **GraphQL**: http://localhost:3000/api/graphql

## 📋 Variabili Ambiente

### Database
```env
DATABASE_URL="postgresql://doggo_user:doggo_password@localhost:5432/doggo"
REDIS_URL="redis://localhost:6379"
```

### Applicazione
```env
PAYLOAD_SECRET="your-super-secret-key-32-chars-min"
JWT_SECRET="your-jwt-secret-key-32-chars-minimum"
NEXTAUTH_SECRET="your-nextauth-secret-key-32-chars"
NEXTAUTH_URL="http://localhost:3001"
```

### Servizi Esterni
```env
# Stripe
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# SendGrid
SENDGRID_API_KEY="SG...."
FROM_EMAIL="noreply@doggo.com"

# Twilio
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+1234567890"

# Daily.co
DAILY_API_KEY="your-daily-api-key"
DAILY_DOMAIN="your-domain.daily.co"

# Google Maps
GOOGLE_MAPS_API_KEY="your-google-maps-key"

# OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

## 🏃‍♂️ Scripts Disponibili

```bash
# Development
npm run dev              # Start all services
npm run dev:cms         # Backend only
npm run dev:web         # Frontend only

# Build & Production
npm run build           # Build all apps
npm run start           # Start production servers

# Database
npm run db:generate     # Generate Prisma client
npm run db:push        # Push schema to database
npm run db:seed        # Seed with sample data
npm run db:studio      # Open Prisma Studio

# Utilities
npm run lint           # Lint all code
npm run type-check     # TypeScript check
npm run clean          # Clean build artifacts
```

## 📱 API Endpoints

### Autenticazione
```
POST /auth/register     # Registrazione utente
POST /auth/login        # Login
POST /auth/logout       # Logout
POST /auth/verify       # Verifica email
POST /auth/reset        # Reset password
```

### Booking Veterinari
```
GET    /api/veterinarians/search     # Ricerca geo-localizzata
GET    /api/veterinarians/:id/availability  # Slot disponibili
POST   /api/bookings                # Crea prenotazione
PATCH  /api/bookings/:id/cancel     # Annulla
POST   /api/triage                  # Sistema triage
```

### TinDog Social
```
GET    /api/dogs/matches            # Trova match
POST   /api/matches                 # Gestisci match
GET    /api/chats                   # Chat utente
POST   /api/messages                # Invia messaggio
```

### Emergenze
```
POST   /api/emergencies             # Segnala emergenza
GET    /api/emergencies/nearby      # Emergenze vicine
PATCH  /api/emergencies/:id/resolve # Risolvi
```

### REV Digitale
```
POST   /api/prescriptions           # Crea ricetta
GET    /api/prescriptions/:id/qr    # QR code
PATCH  /api/prescriptions/:id/dispense # Segna dispensata
```

## 🔒 Sicurezza & Compliance

### Autenticazione
- JWT con refresh token
- Rate limiting per endpoint
- CSRF protection
- Password hashing con bcrypt

### Privacy & GDPR
- Consenso esplicito per dati
- Right to be forgotten
- Data export capabilities
- Cookie policy compliant

### Sicurezza Dati
- Input sanitization
- SQL injection protection
- XSS prevention
- File upload validation

## 📈 Monitoring & Analytics

### Error Tracking
- **Sentry**: Error monitoring e performance
- **Winston**: Logging strutturato
- **Health Checks**: Endpoint per monitoring

### Analytics
- **PostHog**: User analytics GDPR-compliant
- **Custom Metrics**: KPI specifici piattaforma
- **A/B Testing**: Feature flags integrati

## 🚀 Deploy

### Railway (Raccomandato)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway up
```

### Render
```bash
# Connect repository
# Configure environment variables
# Deploy automatically on push
```

### Docker Production
```bash
# Build images
docker build -t doggo-cms ./apps/cms
docker build -t doggo-web ./apps/web

# Deploy with compose
docker-compose -f docker-compose.prod.yml up -d
```

## 🧪 Testing

### Setup Test Environment
```bash
# Create test database
createdb doggo_test

# Run migrations
DATABASE_URL="postgresql://localhost:5432/doggo_test" npm run db:push

# Run tests
npm test
npm run test:e2e
npm run test:coverage
```

### Test Accounts
```
Admin: admin@doggo.com / admin123
Vet: vet1@doggo.com / password
User: user1@example.com / password
```

## 🤝 Contribuire

### Development Workflow
1. Fork del repository
2. Crea feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Apri Pull Request

### Code Guidelines
- **TypeScript Strict Mode**: Sempre tipizzato
- **ESLint + Prettier**: Code formatting automatico  
- **Conventional Commits**: Messaggi commit standardizzati
- **Test Coverage**: Minimo 80% per nuove feature

## 📞 Supporto

### Community
- **Discord**: [Link da definire]
- **GitHub Issues**: Per bug e feature request
- **Documentation**: Wiki completa

### Enterprise Support
- Setup dedicato
- Training team
- Support prioritario
- Custom integrations

## 📄 Licenza

Questo progetto è sotto licenza MIT - vedi [LICENSE](LICENSE) per dettagli.

## 🙏 Riconoscimenti

- **Veterinari Partner**: Per consulenza medica
- **Canili Collaboratori**: Per testing e feedback
- **Community Beta**: Per test pre-release
- **Open Source Libraries**: Vedi package.json per dettagli

---

**Made with ❤️ for dogs and their humans**

🐕 **Perché ogni cane merita una vita felice e sana** 🐕