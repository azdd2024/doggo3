import { z } from 'zod';

// ===========================================
// ENUMS
// ===========================================
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  VETERINARIAN = 'veterinarian',
  SHELTER = 'shelter',
}

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

export enum BookingType {
  GENERAL = 'general',
  URGENT = 'urgent',
  SPECIALIST = 'specialist',
  TELEMEDICINE = 'telemedicine',
}

export enum EmergencyType {
  LOST_DOG = 'lost_dog',
  FOUND_DOG = 'found_dog',
  INJURED_DOG = 'injured_dog',
  ABANDONED_DOG = 'abandoned_dog',
}

export enum DocumentType {
  MICROCHIP = 'microchip',
  PEDIGREE = 'pedigree',
  PASSPORT = 'passport',
  VACCINATION = 'vaccination',
  MEDICAL_RECORD = 'medical_record',
  PRESCRIPTION = 'prescription',
  INSURANCE = 'insurance',
}

export enum DogSize {
  TINY = 'tiny',      // <5kg
  SMALL = 'small',    // 5-15kg
  MEDIUM = 'medium',  // 15-30kg
  LARGE = 'large',    // 30-50kg
  GIANT = 'giant',    // >50kg
}

export enum ActivityLevel {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
}

export enum MatchStatus {
  PENDING = 'pending',
  MATCHED = 'matched',
  REJECTED = 'rejected',
  CHATTING = 'chatting',
  MEETING_PLANNED = 'meeting_planned',
}

// ===========================================
// ZOD SCHEMAS
// ===========================================

// Shared validations
export const emailSchema = z.string().email('Email non valida');
export const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Numero di telefono non valido');
export const passwordSchema = z.string().min(8, 'Password deve essere di almeno 8 caratteri');
export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// User schemas
export const userSchema = z.object({
  id: z.string().uuid(),
  email: emailSchema,
  firstName: z.string().min(1, 'Nome richiesto'),
  lastName: z.string().min(1, 'Cognome richiesto'),
  phone: phoneSchema.optional(),
  avatar: z.string().url().optional(),
  role: z.nativeEnum(UserRole),
  isVerified: z.boolean().default(false),
  isActive: z.boolean().default(true),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string().default('IT'),
    coordinates: coordinatesSchema.optional(),
  }).optional(),
  preferences: z.object({
    language: z.enum(['it', 'en']).default('it'),
    notifications: z.object({
      email: z.boolean().default(true),
      sms: z.boolean().default(false),
      push: z.boolean().default(true),
    }),
    privacy: z.object({
      showProfile: z.boolean().default(true),
      showLocation: z.boolean().default(false),
      allowMatching: z.boolean().default(true),
    }),
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Dog schemas
export const dogSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  name: z.string().min(1, 'Nome cane richiesto'),
  breed: z.string().min(1, 'Razza richiesta'),
  birthDate: z.date(),
  gender: z.enum(['maschio', 'femmina']),
  size: z.nativeEnum(DogSize),
  weight: z.number().positive('Peso deve essere positivo'),
  color: z.string(),
  microchipNumber: z.string().optional(),
  isNeutered: z.boolean().default(false),
  activityLevel: z.nativeEnum(ActivityLevel),
  temperament: z.array(z.string()),
  medicalNotes: z.string().optional(),
  dietaryNeeds: z.string().optional(),
  photos: z.array(z.string().url()),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Veterinarian schemas
export const veterinarianSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  licenseNumber: z.string(),
  specializations: z.array(z.string()),
  clinicName: z.string(),
  clinicAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string().default('IT'),
    coordinates: coordinatesSchema,
  }),
  workingHours: z.array(z.object({
    dayOfWeek: z.number().min(0).max(6), // 0 = Sunday
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    isAvailable: z.boolean().default(true),
  })),
  consultationFee: z.number().positive(),
  emergencyFee: z.number().positive(),
  telemedicineFee: z.number().positive(),
  isVerified: z.boolean().default(false),
  rating: z.number().min(0).max(5).default(0),
  totalReviews: z.number().default(0),
  isAcceptingPatients: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Booking schemas
export const bookingSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  dogId: z.string().uuid(),
  veterinarianId: z.string().uuid(),
  type: z.nativeEnum(BookingType),
  status: z.nativeEnum(BookingStatus),
  scheduledAt: z.date(),
  duration: z.number().positive().default(30), // minutes
  symptoms: z.string().optional(),
  urgencyScore: z.number().min(1).max(10).optional(),
  triageNotes: z.string().optional(),
  consultationNotes: z.string().optional(),
  prescription: z.string().optional(),
  followUpRequired: z.boolean().default(false),
  followUpDate: z.date().optional(),
  totalCost: z.number().positive(),
  paymentStatus: z.enum(['pending', 'paid', 'refunded']).default('pending'),
  paymentIntentId: z.string().optional(),
  cancelledReason: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Document schemas
export const documentSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  dogId: z.string().uuid().optional(),
  type: z.nativeEnum(DocumentType),
  title: z.string(),
  description: z.string().optional(),
  fileUrl: z.string().url(),
  fileName: z.string(),
  fileSize: z.number().positive(),
  mimeType: z.string(),
  issuedDate: z.date().optional(),
  expirationDate: z.date().optional(),
  issuedBy: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  isVerified: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Emergency schemas
export const emergencySchema = z.object({
  id: z.string().uuid(),
  reporterId: z.string().uuid(),
  type: z.nativeEnum(EmergencyType),
  title: z.string(),
  description: z.string(),
  location: z.object({
    address: z.string(),
    coordinates: coordinatesSchema,
  }),
  dogInfo: z.object({
    name: z.string().optional(),
    breed: z.string().optional(),
    color: z.string().optional(),
    size: z.nativeEnum(DogSize).optional(),
    gender: z.enum(['maschio', 'femmina']).optional(),
    age: z.number().optional(),
    microchipNumber: z.string().optional(),
  }),
  photos: z.array(z.string().url()),
  contactInfo: z.object({
    name: z.string(),
    phone: phoneSchema,
    preferredContactMethod: z.enum(['phone', 'email', 'both']),
  }),
  isResolved: z.boolean().default(false),
  resolvedAt: z.date().optional(),
  resolvedBy: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Match schemas (Tindog)
export const matchSchema = z.object({
  id: z.string().uuid(),
  dog1Id: z.string().uuid(),
  dog2Id: z.string().uuid(),
  status: z.nativeEnum(MatchStatus),
  matchScore: z.number().min(0).max(100),
  user1Action: z.enum(['pending', 'liked', 'passed']).default('pending'),
  user2Action: z.enum(['pending', 'liked', 'passed']).default('pending'),
  chatId: z.string().uuid().optional(),
  matchedAt: z.date().optional(),
  meetingPlannedAt: z.date().optional(),
  meetingLocation: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Chat schemas
export const chatSchema = z.object({
  id: z.string().uuid(),
  participants: z.array(z.string().uuid()),
  type: z.enum(['direct', 'group', 'support']),
  title: z.string().optional(),
  lastMessageAt: z.date().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const messageSchema = z.object({
  id: z.string().uuid(),
  chatId: z.string().uuid(),
  senderId: z.string().uuid(),
  content: z.string(),
  type: z.enum(['text', 'image', 'file', 'location', 'system']).default('text'),
  metadata: z.record(z.any()).optional(),
  isEdited: z.boolean().default(false),
  editedAt: z.date().optional(),
  readBy: z.array(z.object({
    userId: z.string().uuid(),
    readAt: z.date(),
  })),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Notification schemas
export const notificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.enum([
    'booking_confirmed',
    'booking_reminder',
    'booking_cancelled',
    'new_message',
    'new_match',
    'emergency_alert',
    'document_expiring',
    'system_update',
  ]),
  title: z.string(),
  message: z.string(),
  data: z.record(z.any()).optional(),
  isRead: z.boolean().default(false),
  readAt: z.date().optional(),
  createdAt: z.date(),
});

// ===========================================
// TYPE EXPORTS
// ===========================================
export type User = z.infer<typeof userSchema>;
export type Dog = z.infer<typeof dogSchema>;
export type Veterinarian = z.infer<typeof veterinarianSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type Document = z.infer<typeof documentSchema>;
export type Emergency = z.infer<typeof emergencySchema>;
export type Match = z.infer<typeof matchSchema>;
export type Chat = z.infer<typeof chatSchema>;
export type Message = z.infer<typeof messageSchema>;
export type Notification = z.infer<typeof notificationSchema>;

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Real-time event types
export interface SocketEvent {
  type: string;
  data: any;
  timestamp: Date;
  userId?: string;
}

// Dashboard analytics types
export interface DashboardStats {
  totalUsers: number;
  totalDogs: number;
  totalBookings: number;
  totalRevenue: number;
  activeVeterinarians: number;
  recentBookings: Booking[];
  topVeterinarians: (Veterinarian & { bookingCount: number })[];
  monthlyStats: Array<{
    month: string;
    users: number;
    bookings: number;
    revenue: number;
  }>;
}

// Search and filter types
export interface VeterinarianSearchFilters {
  location?: {
    latitude: number;
    longitude: number;
    radius: number; // in km
  };
  specializations?: string[];
  availableDate?: Date;
  minRating?: number;
  maxFee?: number;
  acceptsTelemedicine?: boolean;
}

export interface DogSearchFilters {
  breeds?: string[];
  sizes?: DogSize[];
  ageRange?: {
    min: number;
    max: number;
  };
  activityLevel?: ActivityLevel[];
  temperament?: string[];
  location?: {
    latitude: number;
    longitude: number;
    radius: number;
  };
}

// Triage system types
export interface TriageQuestion {
  id: string;
  question: string;
  type: 'boolean' | 'multiple' | 'scale';
  options?: string[];
  weight: number;
  category: 'symptoms' | 'behavior' | 'history' | 'urgency';
}

export interface TriageResponse {
  questionId: string;
  answer: string | number | boolean;
}

export interface TriageResult {
  score: number;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  suggestedActions: string[];
  veterinarianRequired: boolean;
  emergencyServices: boolean;
}

// Prescription (REV) types
export interface Prescription {
  id: string;
  veterinarianId: string;
  patientId: string; // dogId
  ownerId: string;
  drugName: string;
  activeIngredient: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string;
  warnings?: string;
  issueDate: Date;
  validUntil: Date;
  qrCode: string;
  digitalSignature: string;
  isDispensed: boolean;
  dispensedAt?: Date;
  pharmacyId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const prescriptionSchema = z.object({
  id: z.string().uuid(),
  veterinarianId: z.string().uuid(),
  patientId: z.string().uuid(),
  ownerId: z.string().uuid(),
  drugName: z.string().min(1, 'Nome farmaco richiesto'),
  activeIngredient: z.string().min(1, 'Principio attivo richiesto'),
  dosage: z.string().min(1, 'Dosaggio richiesto'),
  frequency: z.string().min(1, 'Frequenza richiesta'),
  duration: z.string().min(1, 'Durata richiesta'),
  quantity: z.number().positive('Quantità deve essere positiva'),
  instructions: z.string().min(1, 'Istruzioni richieste'),
  warnings: z.string().optional(),
  issueDate: z.date(),
  validUntil: z.date(),
  qrCode: z.string(),
  digitalSignature: z.string(),
  isDispensed: z.boolean().default(false),
  dispensedAt: z.date().optional(),
  pharmacyId: z.string().uuid().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Video call types
export interface VideoCallSession {
  id: string;
  bookingId: string;
  dailyRoomUrl: string;
  dailyRoomName: string;
  participants: Array<{
    userId: string;
    joinedAt?: Date;
    leftAt?: Date;
    duration?: number;
  }>;
  recordingUrl?: string;
  startedAt?: Date;
  endedAt?: Date;
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

// Food calculation types
export interface FoodCalculation {
  dogId: string;
  currentWeight: number;
  idealWeight: number;
  activityLevel: ActivityLevel;
  age: number; // in months
  isNeutered: boolean;
  dailyCalories: number;
  portionGrams: number;
  feedingTimes: number;
  portionPerMeal: number;
  recommendations: string[];
  warnings?: string[];
}

// Shelter/Association types
export interface Shelter {
  id: string;
  userId: string;
  name: string;
  registrationNumber: string;
  type: 'public' | 'private' | 'association';
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  contactInfo: {
    phone: string;
    email: string;
    website?: string;
    socialMedia?: {
      facebook?: string;
      instagram?: string;
      twitter?: string;
    };
  };
  capacity: number;
  currentOccupancy: number;
  specializations: string[]; // e.g., ['senior_dogs', 'puppies', 'disabled_dogs']
  services: string[]; // e.g., ['veterinary', 'training', 'grooming']
  isVerified: boolean;
  rating: number;
  totalReviews: number;
  adoptionFee: {
    min: number;
    max: number;
  };
  requirements: {
    homeVisit: boolean;
    references: boolean;
    experience: boolean;
    fencedYard: boolean;
    otherPets: boolean;
  };
  workingHours: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isOpen: boolean;
  }>;
  photos: string[];
  description: string;
  mission?: string;
  achievements?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdoptableDog extends Omit<Dog, 'ownerId'> {
  shelterId: string;
  story?: string;
  specialNeeds?: string[];
  goodWith: {
    children: boolean;
    cats: boolean;
    dogs: boolean;
  };
  adoptionFee: number;
  adoptionStatus: 'available' | 'pending' | 'adopted' | 'hold';
  intakeDate: Date;
  adoptionDate?: Date;
  fosterable: boolean;
  urgent: boolean;
  featured: boolean;
}

export interface AdoptionApplication {
  id: string;
  dogId: string;
  applicantId: string;
  shelterId: string;
  status: 'pending' | 'approved' | 'rejected' | 'interview' | 'home_visit' | 'completed';
  application: {
    housing: {
      type: 'house' | 'apartment' | 'condo';
      ownership: 'own' | 'rent';
      yardSize?: string;
      fenced: boolean;
    };
    experience: {
      previousPets: boolean;
      currentPets: Array<{
        type: string;
        age: number;
        vaccinated: boolean;
      }>;
      experience: string;
    };
    lifestyle: {
      hoursAlone: number;
      activity: string;
      children: boolean;
      childrenAges?: number[];
    };
    veterinarian: {
      name?: string;
      phone?: string;
      relationship?: string;
    };
    references: Array<{
      name: string;
      relationship: string;
      phone: string;
    }>;
    motivation: string;
    expectations: string;
  };
  notes?: string;
  interviewDate?: Date;
  homeVisitDate?: Date;
  adoptionDate?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Donation types
export interface Donation {
  id: string;
  donorId?: string; // null for anonymous
  shelterId: string;
  amount: number;
  currency: string;
  type: 'one_time' | 'monthly' | 'yearly';
  purpose: 'general' | 'medical' | 'food' | 'shelter' | 'specific_dog';
  specificDogId?: string;
  isAnonymous: boolean;
  paymentMethod: string;
  paymentIntentId: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Event types (for shelters and associations)
export interface Event {
  id: string;
  organizerId: string; // shelterId or userId
  title: string;
  description: string;
  type: 'adoption' | 'fundraising' | 'training' | 'awareness' | 'volunteer';
  startDate: Date;
  endDate: Date;
  location: {
    address: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  maxParticipants?: number;
  currentParticipants: number;
  requiresRegistration: boolean;
  registrationDeadline?: Date;
  fee?: number;
  photos: string[];
  tags: string[];
  isPublic: boolean;
  isActive: boolean;
  participants: Array<{
    userId: string;
    registeredAt: Date;
    status: 'registered' | 'attended' | 'cancelled';
  }>;
  createdAt: Date;
  updatedAt: Date;
}

// Analytics and reporting types
export interface VeterinarianAnalytics {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  averageRating: number;
  totalRevenue: number;
  monthlyStats: Array<{
    month: string;
    bookings: number;
    revenue: number;
    newPatients: number;
  }>;
  popularServices: Array<{
    service: string;
    count: number;
    revenue: number;
  }>;
  patientRetention: number;
  averageConsultationTime: number;
}

export interface ShelterAnalytics {
  totalDogs: number;
  adoptedDogs: number;
  adoptionRate: number;
  averageStayDuration: number;
  totalDonations: number;
  donationTrend: Array<{
    month: string;
    amount: number;
    donors: number;
  }>;
  eventParticipation: Array<{
    event: string;
    participants: number;
    date: Date;
  }>;
  volunteerHours: number;
}

// WebSocket event types
export type WebSocketEventType = 
  | 'user_online'
  | 'user_offline'
  | 'new_message'
  | 'message_read'
  | 'typing_start'
  | 'typing_stop'
  | 'booking_status_change'
  | 'emergency_alert'
  | 'match_notification'
  | 'system_notification';

export interface WebSocketMessage {
  type: WebSocketEventType;
  payload: any;
  userId?: string;
  timestamp: Date;
}

// Geolocation utilities
export interface LocationPoint {
  latitude: number;
  longitude: number;
}

export interface LocationBounds {
  northeast: LocationPoint;
  southwest: LocationPoint;
}

// File upload types
export interface FileUpload {
  file: File;
  category: 'document' | 'photo' | 'avatar' | 'prescription';
  metadata?: Record<string, any>;
}

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
  size: number;
  mimeType: string;
}

// Rate limiting types
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// Email template types
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: string[];
  category: 'transactional' | 'marketing' | 'notification';
  isActive: boolean;
}

export interface EmailData {
  to: string;
  from?: string;
  subject: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
  html?: string;
  text?: string;
}

// SMS template types
export interface SmsTemplate {
  id: string;
  name: string;
  content: string;
  variables: string[];
  isActive: boolean;
}

export interface SmsData {
  to: string;
  templateId?: string;
  variables?: Record<string, any>;
  content?: string;
}

// Push notification types
export interface PushNotification {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  clickAction?: string;
  badge?: number;
}

// Error types
export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;
  details?: any;
}

// Validation types
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

// Cache types
export interface CacheOptions {
  ttl?: number; // seconds
  tags?: string[];
}

// Audit log types
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// Configuration types
export interface AppConfig {
  app: {
    name: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
    url: string;
  };
  database: {
    url: string;
    ssl: boolean;
    poolSize: number;
  };
  redis: {
    url: string;
    keyPrefix: string;
  };
  storage: {
    provider: 'local' | 'minio' | 'r2';
    bucket: string;
    region: string;
    publicUrl: string;
  };
  email: {
    provider: 'sendgrid' | 'mailgun' | 'ses';
    from: string;
    fromName: string;
  };
  sms: {
    provider: 'twilio' | 'vonage';
    from: string;
  };
  video: {
    provider: 'daily' | 'agora' | 'webrtc';
    domain: string;
  };
  payment: {
    provider: 'stripe' | 'paypal';
    currency: string;
    webhook: string;
  };
  security: {
    jwtSecret: string;
    jwtExpiration: string;
    bcryptRounds: number;
    rateLimiting: boolean;
  };
  features: {
    telemedicine: boolean;
    matching: boolean;
    payments: boolean;
    notifications: boolean;
    analytics: boolean;
  };
}

export default {
  UserRole,
  BookingStatus,
  BookingType,
  EmergencyType,
  DocumentType,
  DogSize,
  ActivityLevel,
  MatchStatus,
  userSchema,
  dogSchema,
  veterinarianSchema,
  bookingSchema,
  documentSchema,
  emergencySchema,
  matchSchema,
  chatSchema,
  messageSchema,
  notificationSchema,
  prescriptionSchema,
  emailSchema,
  phoneSchema,
  passwordSchema,
  coordinatesSchema,
};