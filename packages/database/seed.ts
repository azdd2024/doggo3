import { PrismaClient } from '@prisma/client';
import { CryptoUtils } from '@doggo/utils';
import type { UserRole, DogSize, ActivityLevel, BookingType, EmergencyType } from '@doggo/types';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create system configuration
  await seedSystemConfig();
  
  // Create email templates
  await seedEmailTemplates();
  
  // Create SMS templates
  await seedSmsTemplates();
  
  // Create users
  const admin = await seedAdmin();
  const users = await seedUsers();
  const veterinarians = await seedVeterinarians();
  const shelters = await seedShelters();
  
  // Create dogs
  const dogs = await seedDogs(users);
  const adoptableDogs = await seedAdoptableDogs(shelters);
  
  // Create bookings
  await seedBookings(users, dogs, veterinarians);
  
  // Create emergencies
  await seedEmergencies(users);
  
  // Create matches
  await seedMatches(dogs);
  
  // Create events
  await seedEvents(shelters);
  
  // Create sample donations
  await seedDonations(users, shelters);

  console.log('✅ Database seeding completed!');
}

async function seedSystemConfig() {
  console.log('Creating system configuration...');
  
  const configs = [
    {
      key: 'app_name',
      value: 'Doggo Platform',
      description: 'Application name'
    },
    {
      key: 'app_version',
      value: '1.0.0',
      description: 'Application version'
    },
    {
      key: 'maintenance_mode',
      value: false,
      description: 'Maintenance mode flag'
    },
    {
      key: 'max_file_size',
      value: 10485760, // 10MB
      description: 'Maximum file upload size in bytes'
    },
    {
      key: 'allowed_file_types',
      value: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
      description: 'Allowed file upload types'
    },
    {
      key: 'booking_advance_days',
      value: 30,
      description: 'Maximum days in advance for bookings'
    },
    {
      key: 'emergency_radius_km',
      value: 50,
      description: 'Emergency notification radius in kilometers'
    }
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: { value: config.value, description: config.description },
      create: config
    });
  }
}

async function seedEmailTemplates() {
  console.log('Creating email templates...');
  
  const templates = [
    {
      name: 'welcome',
      subject: 'Benvenuto su Doggo! 🐕',
      htmlContent: `
        <h1>Benvenuto su Doggo!</h1>
        <p>Ciao {{firstName}},</p>
        <p>Siamo felici di averti nella nostra community! Doggo è la piattaforma completa per te e il tuo migliore amico a quattro zampe.</p>
        <h2>Cosa puoi fare:</h2>
        <ul>
          <li>Prenotare visite veterinarie</li>
          <li>Gestire la cartella clinica del tuo cane</li>
          <li>Trovare altri cani per socializzare</li>
          <li>Segnalare emergenze</li>
        </ul>
        <a href="{{loginUrl}}" style="background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Inizia ora</a>
      `,
      textContent: 'Benvenuto su Doggo! Inizia a utilizzare la piattaforma per gestire la salute e il benessere del tuo cane.',
      variables: ['firstName', 'loginUrl'],
      category: 'transactional'
    },
    {
      name: 'booking_confirmation',
      subject: 'Prenotazione confermata - {{clinicName}}',
      htmlContent: `
        <h1>Prenotazione Confermata</h1>
        <p>La tua prenotazione è stata confermata:</p>
        <div style="background: #F3F4F6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Veterinario:</strong> {{clinicName}}</p>
          <p><strong>Data:</strong> {{date}}</p>
          <p><strong>Orario:</strong> {{time}}</p>
          <p><strong>Paziente:</strong> {{dogName}}</p>
          <p><strong>Tipo visita:</strong> {{bookingType}}</p>
        </div>
        <p>Ti ricordiamo di portare:</p>
        <ul>
          <li>Libretto sanitario</li>
          <li>Eventuali esami precedenti</li>
          <li>Lista dei farmaci attuali</li>
        </ul>
      `,
      textContent: 'Prenotazione confermata per {{dogName}} il {{date}} alle {{time}} presso {{clinicName}}',
      variables: ['clinicName', 'date', 'time', 'dogName', 'bookingType'],
      category: 'transactional'
    },
    {
      name: 'emergency_alert',
      subject: '🚨 Allerta Emergenza nelle vicinanze',
      htmlContent: `
        <h1>🚨 Allerta Emergenza</h1>
        <p>È stata segnalata un'emergenza nella tua zona:</p>
        <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 16px; margin: 16px 0;">
          <p><strong>Tipo:</strong> {{emergencyType}}</p>
          <p><strong>Descrizione:</strong> {{description}}</p>
          <p><strong>Posizione:</strong> {{location}}</p>
          <p><strong>Distanza:</strong> {{distance}} km</p>
        </div>
        <a href="{{emergencyUrl}}" style="background: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Visualizza Dettagli</a>
      `,
      textContent: 'Emergenza segnalata: {{emergencyType}} a {{distance}}km da te. Dettagli: {{emergencyUrl}}',
      variables: ['emergencyType', 'description', 'location', 'distance', 'emergencyUrl'],
      category: 'notification'
    }
  ];

  for (const template of templates) {
    await prisma.emailTemplate.upsert({
      where: { name: template.name },
      update: template,
      create: template
    });
  }
}

async function seedSmsTemplates() {
  console.log('Creating SMS templates...');
  
  const templates = [
    {
      name: 'booking_reminder',
      content: 'Ricorda: visita per {{dogName}} domani alle {{time}} presso {{clinicName}}. Info: {{phone}}',
      variables: ['dogName', 'time', 'clinicName', 'phone']
    },
    {
      name: 'emergency_alert',
      content: '🚨 {{emergencyType}} segnalato a {{distance}}km. Dettagli: {{url}}',
      variables: ['emergencyType', 'distance', 'url']
    },
    {
      name: 'match_notification',
      content: '💖 Nuovo match! {{dog1}} e {{dog2}} sono compatibili al {{score}}%. Inizia a chattare!',
      variables: ['dog1', 'dog2', 'score']
    }
  ];

  for (const template of templates) {
    await prisma.smsTemplate.upsert({
      where: { name: template.name },
      update: template,
      create: template
    });
  }
}

async function seedAdmin() {
  console.log('Creating admin user...');
  
  return await prisma.user.upsert({
    where: { email: 'admin@doggo.com' },
    update: {},
    create: {
      email: 'admin@doggo.com',
      firstName: 'Admin',
      lastName: 'Doggo',
      role: 'ADMIN' as UserRole,
      isVerified: true,
      preferences: {
        language: 'it',
        notifications: { email: true, sms: true, push: true },
        privacy: { showProfile: false, showLocation: false, allowMatching: false }
      }
    }
  });
}

async function seedUsers() {
  console.log('Creating regular users...');
  
  const users = [];
  const cities = ['Roma', 'Milano', 'Napoli', 'Torino', 'Palermo', 'Genova', 'Bologna', 'Firenze'];
  const streets = ['Via Roma', 'Via Milano', 'Corso Italia', 'Via Garibaldi', 'Piazza Venezia'];
  
  for (let i = 1; i <= 50; i++) {
    const city = cities[Math.floor(Math.random() * cities.length)];
    const street = streets[Math.floor(Math.random() * streets.length)];
    
    const user = await prisma.user.create({
      data: {
        email: `user${i}@example.com`,
        firstName: `Mario${i}`,
        lastName: `Rossi${i}`,
        phone: `+39${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        role: 'USER' as UserRole,
        isVerified: Math.random() > 0.2, // 80% verified
        address: {
          street: `${street} ${Math.floor(Math.random() * 100) + 1}`,
          city,
          state: 'Italia',
          zipCode: `${Math.floor(Math.random() * 90000) + 10000}`,
          country: 'IT',
          coordinates: {
            latitude: 41.9028 + (Math.random() - 0.5) * 10, // Around Italy
            longitude: 12.4964 + (Math.random() - 0.5) * 10
          }
        },
        preferences: {
          language: 'it',
          notifications: {
            email: true,
            sms: Math.random() > 0.5,
            push: true
          },
          privacy: {
            showProfile: Math.random() > 0.3,
            showLocation: Math.random() > 0.5,
            allowMatching: Math.random() > 0.2
          }
        }
      }
    });
    users.push(user);
  }
  
  return users;
}

async function seedVeterinarians() {
  console.log('Creating veterinarians...');
  
  const vets = [];
  const clinicNames = [
    'Clinica Veterinaria San Francesco',
    'Centro Veterinario Milano',
    'Ospedale Veterinario Roma',
    'Clinica del Cane e del Gatto',
    'Centro Medico Veterinario'
  ];
  
  for (let i = 1; i <= 10; i++) {
    const user = await prisma.user.create({
      data: {
        email: `vet${i}@doggo.com`,
        firstName: `Dr. Veterinario${i}`,
        lastName: `Bianchi${i}`,
        phone: `+39${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        role: 'VETERINARIAN' as UserRole,
        isVerified: true
      }
    });

    const vet = await prisma.veterinarian.create({
      data: {
        userId: user.id,
        licenseNumber: `VET${String(i).padStart(6, '0')}`,
        specializations: [
          'Medicina Generale',
          'Chirurgia',
          'Dermatologia',
          'Cardiologia'
        ].slice(0, Math.floor(Math.random() * 4) + 1),
        clinicName: clinicNames[Math.floor(Math.random() * clinicNames.length)],
        clinicAddress: {
          street: `Via Veterinaria ${i}`,
          city: ['Roma', 'Milano', 'Napoli'][Math.floor(Math.random() * 3)],
          state: 'Italia',
          zipCode: `${Math.floor(Math.random() * 90000) + 10000}`,
          country: 'IT',
          coordinates: {
            latitude: 41.9028 + (Math.random() - 0.5) * 2,
            longitude: 12.4964 + (Math.random() - 0.5) * 2
          }
        },
        workingHours: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isAvailable: true },
          { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', isAvailable: true },
          { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', isAvailable: true },
          { dayOfWeek: 4, startTime: '09:00', endTime: '18:00', isAvailable: true },
          { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', isAvailable: true },
          { dayOfWeek: 6, startTime: '09:00', endTime: '13:00', isAvailable: true }
        ],
        consultationFee: Math.floor(Math.random() * 30) + 40, // 40-70 EUR
        emergencyFee: Math.floor(Math.random() * 50) + 80, // 80-130 EUR
        telemedicineFee: Math.floor(Math.random() * 20) + 25, // 25-45 EUR
        isVerified: true,
        rating: Number((Math.random() * 2 + 3).toFixed(1)), // 3.0-5.0
        totalReviews: Math.floor(Math.random() * 100) + 5,
        isAcceptingPatients: Math.random() > 0.1 // 90% accepting
      }
    });
    
    vets.push(vet);
  }
  
  return vets;
}

async function seedShelters() {
  console.log('Creating shelters...');
  
  const shelters = [];
  const shelterNames = [
    'Canile Comunale Roma',
    'Associazione Amici degli Animali',
    'ENPA Milano',
    'Rifugio del Cane',
    'Lega del Cane Napoli'
  ];
  
  for (let i = 1; i <= 5; i++) {
    const user = await prisma.user.create({
      data: {
        email: `shelter${i}@doggo.com`,
        firstName: `Responsabile${i}`,
        lastName: `Canile${i}`,
        role: 'SHELTER' as UserRole,
        isVerified: true
      }
    });

    const shelter = await prisma.shelter.create({
      data: {
        userId: user.id,
        name: shelterNames[i - 1],
        registrationNumber: `SHELTER${String(i).padStart(6, '0')}`,
        type: ['public', 'private', 'association'][Math.floor(Math.random() * 3)],
        address: {
          street: `Via del Canile ${i}`,
          city: ['Roma', 'Milano', 'Napoli', 'Torino', 'Bologna'][i - 1],
          state: 'Italia',
          zipCode: `${Math.floor(Math.random() * 90000) + 10000}`,
          country: 'IT',
          coordinates: {
            latitude: 41.9028 + (Math.random() - 0.5) * 5,
            longitude: 12.4964 + (Math.random() - 0.5) * 5
          }
        },
        contactInfo: {
          phone: `+39${Math.floor(Math.random() * 9000000000) + 1000000000}`,
          email: `shelter${i}@doggo.com`,
          website: `https://shelter${i}.example.com`
        },
        capacity: Math.floor(Math.random() * 50) + 20,
        currentOccupancy: Math.floor(Math.random() * 30) + 10,
        specializations: ['cani_anziani', 'cuccioli', 'cani_disabili'].slice(0, Math.floor(Math.random() * 3) + 1),
        services: ['veterinario', 'addestramento', 'toelettatura'].slice(0, Math.floor(Math.random() * 3) + 1),
        isVerified: true,
        adoptionFee: { min: 50, max: 200 },
        requirements: {
          homeVisit: Math.random() > 0.5,
          references: true,
          experience: Math.random() > 0.3,
          fencedYard: Math.random() > 0.6,
          otherPets: Math.random() > 0.4
        },
        workingHours: [
          { dayOfWeek: 1, startTime: '08:00', endTime: '17:00', isOpen: true },
          { dayOfWeek: 2, startTime: '08:00', endTime: '17:00', isOpen: true },
          { dayOfWeek: 3, startTime: '08:00', endTime: '17:00', isOpen: true },
          { dayOfWeek: 4, startTime: '08:00', endTime: '17:00', isOpen: true },
          { dayOfWeek: 5, startTime: '08:00', endTime: '17:00', isOpen: true },
          { dayOfWeek: 6, startTime: '09:00', endTime: '13:00', isOpen: true }
        ],
        photos: [
          `https://picsum.photos/800/600?random=shelter${i}1`,
          `https://picsum.photos/800/600?random=shelter${i}2`
        ],
        description: `Canile dedicato al benessere degli animali abbandonati. Offriamo cure mediche, riabilitazione e trovare famiglie amorevoli per i nostri ospiti.`,
        mission: `La nostra missione è garantire una seconda possibilità a tutti i cani in difficoltà.`,
        achievements: [
          `${Math.floor(Math.random() * 500) + 100} cani adottati`,
          `${Math.floor(Math.random() * 50) + 10} anni di attività`,
          'Certificazione benessere animale'
        ]
      }
    });
    
    shelters.push(shelter);
  }
  
  return shelters;
}

async function seedDogs(users: any[]) {
  console.log('Creating dogs...');
  
  const dogs = [];
  const breeds = [
    'Labrador Retriever', 'Golden Retriever', 'Pastore Tedesco', 'Bulldog Francese',
    'Beagle', 'Rottweiler', 'Yorkshire Terrier', 'Chihuahua', 'Siberian Husky',
    'Border Collie', 'Boxer', 'Dachshund', 'Poodle', 'Shih Tzu', 'Boston Terrier',
    'Meticcio', 'Jack Russell Terrier', 'Cocker Spaniel', 'Maltese', 'Pinscher'
  ];
  
  const colors = ['Nero', 'Bianco', 'Marrone', 'Bianco e Nero', 'Marrone e Bianco', 'Dorato', 'Grigio'];
  const temperaments = [
    'Amichevole', 'Energico', 'Calmo', 'Protettivo', 'Giocoso', 'Intelligente',
    'Leale', 'Docile', 'Coraggioso', 'Affettuoso', 'Indipendente', 'Socievole'
  ];
  
  for (let i = 0; i < users.length * 2; i++) {
    const owner = users[Math.floor(Math.random() * users.length)];
    const breed = breeds[Math.floor(Math.random() * breeds.length)];
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - Math.floor(Math.random() * 15) - 1);
    
    let size: DogSize;
    if (['Chihuahua', 'Yorkshire Terrier', 'Maltese'].includes(breed)) {
      size = 'TINY' as DogSize;
    } else if (['Beagle', 'Boston Terrier', 'Jack Russell Terrier'].includes(breed)) {
      size = 'SMALL' as DogSize;
    } else if (['Border Collie', 'Cocker Spaniel'].includes(breed)) {
      size = 'MEDIUM' as DogSize;
    } else if (['Labrador Retriever', 'Golden Retriever', 'Pastore Tedesco'].includes(breed)) {
      size = 'LARGE' as DogSize;
    } else {
      size = ['SMALL', 'MEDIUM', 'LARGE'][Math.floor(Math.random() * 3)] as DogSize;
    }
    
    const weightRanges = {
      TINY: [2, 6],
      SMALL: [7, 15],
      MEDIUM: [16, 30],
      LARGE: [31, 50],
      GIANT: [51, 80]
    };
    
    const [minWeight, maxWeight] = weightRanges[size];
    const weight = Math.floor(Math.random() * (maxWeight - minWeight)) + minWeight;
    
    const selectedTemperaments = temperaments
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(Math.random() * 4) + 2);
    
    const dog = await prisma.dog.create({
      data: {
        ownerId: owner.id,
        name: `${['Max', 'Buddy', 'Charlie', 'Jack', 'Cooper', 'Rocky', 'Toby', 'Tucker', 'Jake', 'Bailey', 'Bella', 'Molly', 'Lucy', 'Maggie', 'Daisy', 'Sophie', 'Sadie', 'Chloe', 'Lola', 'Zoe'][Math.floor(Math.random() * 20)]}`,
        breed,
        birthDate,
        gender: Math.random() > 0.5 ? 'maschio' : 'femmina',
        size,
        weight,
        color: colors[Math.floor(Math.random() * colors.length)],
        microchipNumber: Math.random() > 0.2 ? `380260${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}` : null,
        isNeutered: Math.random() > 0.4,
        activityLevel: ['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'][Math.floor(Math.random() * 4)] as ActivityLevel,
        temperament: selectedTemperaments,
        medicalNotes: Math.random() > 0.7 ? 'Nessuna condizione medica particolare' : null,
        dietaryNeeds: Math.random() > 0.8 ? 'Dieta speciale per allergie alimentari' : null,
        photos: [
          `https://picsum.photos/400/400?random=dog${i}1`,
          `https://picsum.photos/400/400?random=dog${i}2`
        ]
      }
    });
    
    dogs.push(dog);
  }
  
  return dogs;
}

async function seedAdoptableDogs(shelters: any[]) {
  console.log('Creating adoptable dogs...');
  
  const adoptableDogs = [];
  
  for (const shelter of shelters) {
    const numDogs = Math.floor(Math.random() * 8) + 3; // 3-10 dogs per shelter
    
    for (let i = 0; i < numDogs; i++) {
      // Create the base dog first
      const dog = await prisma.dog.create({
        data: {
          ownerId: null, // No owner yet
          name: `${['Rex', 'Luna', 'Simba', 'Mia', 'Leo', 'Nina', 'Bruno', 'Stella', 'Oscar', 'Coco'][Math.floor(Math.random() * 10)]}`,
          breed: ['Meticcio', 'Pastore Tedesco', 'Labrador Mix', 'Golden Mix', 'Pitbull Mix'][Math.floor(Math.random() * 5)],
          birthDate: new Date(Date.now() - Math.random() * 10 * 365 * 24 * 60 * 60 * 1000), // 0-10 years old
          gender: Math.random() > 0.5 ? 'maschio' : 'femmina',
          size: ['SMALL', 'MEDIUM', 'LARGE'][Math.floor(Math.random() * 3)] as DogSize,
          weight: Math.floor(Math.random() * 30) + 10,
          color: ['Nero', 'Bianco', 'Marrone', 'Tigrato', 'Misto'][Math.floor(Math.random() * 5)],
          microchipNumber: `380260${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
          isNeutered: Math.random() > 0.3,
          activityLevel: ['LOW', 'MODERATE', 'HIGH'][Math.floor(Math.random() * 3)] as ActivityLevel,
          temperament: ['Amichevole', 'Dolce', 'Energico', 'Calmo'].slice(0, Math.floor(Math.random() * 4) + 1),
          photos: [
            `https://picsum.photos/400/400?random=adoptable${shelter.id}${i}1`,
            `https://picsum.photos/400/400?random=adoptable${shelter.id}${i}2`
          ]
        }
      });

      const adoptableDog = await prisma.adoptableDog.create({
        data: {
          dogId: dog.id,
          shelterId: shelter.id,
          story: `Questo dolce cane è stato trovato abbandonato e ora cerca una famiglia amorevole. È molto affettuoso e va d'accordo con tutti.`,
          specialNeeds: Math.random() > 0.8 ? ['Necessita cure mediche speciali'] : [],
          goodWith: {
            children: Math.random() > 0.3,
            cats: Math.random() > 0.5,
            dogs: Math.random() > 0.4
          },
          adoptionFee: Math.floor(Math.random() * 150) + 50,
          adoptionStatus: 'AVAILABLE' as any,
          intakeDate: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000), // Last 6 months
          fosterable: Math.random() > 0.7,
          urgent: Math.random() > 0.9,
          featured: Math.random() > 0.8
        }
      });
      
      adoptableDogs.push(adoptableDog);
    }
  }
  
  return adoptableDogs;
}

async function seedBookings(users: any[], dogs: any[], veterinarians: any[]) {
  console.log('Creating bookings...');
  
  for (let i = 0; i < 30; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const userDogs = dogs.filter(d => d.ownerId === user.id);
    if (userDogs.length === 0) continue;
    
    const dog = userDogs[Math.floor(Math.random() * userDogs.length)];
    const veterinarian = veterinarians[Math.floor(Math.random() * veterinarians.length)];
    
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + Math.floor(Math.random() * 30)); // Next 30 days
    scheduledAt.setHours(9 + Math.floor(Math.random() * 9), 0, 0, 0); // 9-17
    
    const bookingTypes: BookingType[] = ['GENERAL', 'URGENT', 'SPECIALIST', 'TELEMEDICINE'];
    const type = bookingTypes[Math.floor(Math.random() * bookingTypes.length)];
    
    const fees = {
      GENERAL: veterinarian.consultationFee,
      URGENT: veterinarian.emergencyFee,
      SPECIALIST: veterinarian.consultationFee * 1.5,
      TELEMEDICINE: veterinarian.telemedicineFee
    };

    await prisma.booking.create({
      data: {
        userId: user.id,
        dogId: dog.id,
        veterinarianId: veterinarian.id,
        type,
        status: ['PENDING', 'CONFIRMED', 'COMPLETED'][Math.floor(Math.random() * 3)] as any,
        scheduledAt,
        duration: [30, 45, 60][Math.floor(Math.random() * 3)],
        symptoms: Math.random() > 0.5 ? 'Controllo di routine' : 'Problemi digestivi',
        urgencyScore: Math.floor(Math.random() * 10) + 1,
        totalCost: fees[type],
        paymentStatus: Math.random() > 0.2 ? 'PAID' : 'PENDING'
      }
    });
  }
}

async function seedEmergencies(users: any[]) {
  console.log('Creating emergencies...');
  
  const emergencyTypes: EmergencyType[] = ['LOST_DOG', 'FOUND_DOG', 'INJURED_DOG', 'ABANDONED_DOG'];
  const cities = ['Roma', 'Milano', 'Napoli', 'Torino', 'Bologna'];
  
  for (let i = 0; i < 15; i++) {
    const reporter = users[Math.floor(Math.random() * users.length)];
    const type = emergencyTypes[Math.floor(Math.random() * emergencyTypes.length)];
    const city = cities[Math.floor(Math.random() * cities.length)];
    
    const typeLabels = {
      LOST_DOG: 'Cane Smarrito',
      FOUND_DOG: 'Cane Trovato',
      INJURED_DOG: 'Cane Ferito',
      ABANDONED_DOG: 'Cane Abbandonato'
    };

    await prisma.emergency.create({
      data: {
        reporterId: reporter.id,
        type,
        title: `${typeLabels[type]} - ${city}`,
        description: `Segnalazione di ${typeLabels[type].toLowerCase()} nella zona di ${city}. Necessaria assistenza immediata.`,
        location: {
          address: `Via ${city} ${Math.floor(Math.random() * 100) + 1}, ${city}`,
          coordinates: {
            latitude: 41.9028 + (Math.random() - 0.5) * 5,
            longitude: 12.4964 + (Math.random() - 0.5) * 5
          }
        },
        dogInfo: {
          breed: ['Meticcio', 'Pastore Tedesco', 'Labrador'][Math.floor(Math.random() * 3)],
          color: ['Nero', 'Bianco', 'Marrone'][Math.floor(Math.random() * 3)],
          size: ['MEDIUM', 'LARGE'][Math.floor(Math.random() * 2)],
          gender: Math.random() > 0.5 ? 'maschio' : 'femmina'
        },
        photos: [`https://picsum.photos/600/400?random=emergency${i}`],
        contactInfo: {
          name: `${reporter.firstName} ${reporter.lastName}`,
          phone: reporter.phone || '+39123456789',
          preferredContactMethod: 'phone'
        },
        isResolved: Math.random() > 0.7,
        priority: ['medium', 'high', 'critical'][Math.floor(Math.random() * 3)]
      }
    });
  }
}

async function seedMatches(dogs: any[]) {
  console.log('Creating matches...');
  
  for (let i = 0; i < 20; i++) {
    const dog1 = dogs[Math.floor(Math.random() * dogs.length)];
    const dog2 = dogs[Math.floor(Math.random() * dogs.length)];
    
    if (dog1.id === dog2.id || dog1.ownerId === dog2.ownerId) continue;
    
    // Check if match already exists
    const existingMatch = await prisma.match.findFirst({
      where: {
        OR: [
          { dog1Id: dog1.id, dog2Id: dog2.id },
          { dog1Id: dog2.id, dog2Id: dog1.id }
        ]
      }
    });
    
    if (existingMatch) continue;

    await prisma.match.create({
      data: {
        dog1Id: dog1.id,
        dog2Id: dog2.id,
        status: ['PENDING', 'MATCHED', 'CHATTING'][Math.floor(Math.random() * 3)] as any,
        matchScore: Math.floor(Math.random() * 40) + 60, // 60-100%
        user1Action: Math.random() > 0.5 ? 'liked' : 'pending',
        user2Action: Math.random() > 0.5 ? 'liked' : 'pending',
        matchedAt: Math.random() > 0.5 ? new Date() : null
      }
    });
  }
}

async function seedEvents(shelters: any[]) {
  console.log('Creating events...');
  
  for (const shelter of shelters) {
    const numEvents = Math.floor(Math.random() * 3) + 1; // 1-3 events per shelter
    
    for (let i = 0; i < numEvents; i++) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 60)); // Next 2 months
      
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + Math.floor(Math.random() * 6) + 2); // 2-8 hours duration
      
      const eventTypes = ['adoption', 'fundraising', 'training', 'awareness', 'volunteer'];
      const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      
      const eventTitles = {
        adoption: 'Giornata delle Adozioni',
        fundraising: 'Raccolta Fondi',
        training: 'Corso di Addestramento',
        awareness: 'Sensibilizzazione',
        volunteer: 'Giornata del Volontariato'
      };

      await prisma.event.create({
        data: {
          organizerId: shelter.id,
          title: `${eventTitles[type]} - ${shelter.name}`,
          description: `Evento organizzato da ${shelter.name} per promuovere il benessere degli animali.`,
          type,
          startDate,
          endDate,
          location: shelter.address,
          maxParticipants: Math.floor(Math.random() * 50) + 20,
          currentParticipants: Math.floor(Math.random() * 30),
          requiresRegistration: Math.random() > 0.3,
          registrationDeadline: new Date(startDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
          fee: Math.random() > 0.6 ? Math.floor(Math.random() * 20) + 5 : null,
          photos: [`https://picsum.photos/800/400?random=event${shelter.id}${i}`],
          tags: ['animali', 'beneficenza', 'comunità']
        }
      });
    }
  }
}

async function seedDonations(users: any[], shelters: any[]) {
  console.log('Creating donations...');
  
  for (let i = 0; i < 25; i++) {
    const donor = Math.random() > 0.2 ? users[Math.floor(Math.random() * users.length)] : null; // 20% anonymous
    const shelter = shelters[Math.floor(Math.random() * shelters.length)];
    
    await prisma.donation.create({
      data: {
        donorId: donor?.id,
        shelterId: shelter.id,
        amount: Math.floor(Math.random() * 200) + 10, // 10-210 EUR
        currency: 'EUR',
        type: ['one_time', 'monthly', 'yearly'][Math.floor(Math.random() * 3)],
        purpose: ['general', 'medical', 'food', 'shelter'][Math.floor(Math.random() * 4)],
        isAnonymous: !donor,
        paymentMethod: 'stripe',
        paymentIntentId: `pi_${CryptoUtils.generateSecureId(16)}`,
        status: Math.random() > 0.1 ? 'PAID' : 'PENDING',
        message: Math.random() > 0.5 ? 'Grazie per il vostro impegno!' : null
      }
    });
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });