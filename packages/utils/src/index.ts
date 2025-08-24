import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import slugify from 'slugify';
import dayjs from 'dayjs';
import { z } from 'zod';
import type { 
  LocationPoint, 
  TriageResponse, 
  TriageResult, 
  TriageQuestion,
  FoodCalculation,
  ActivityLevel,
  DogSize,
  ApiResponse 
} from '@doggo/types';

// ===========================================
// CRYPTO UTILITIES
// ===========================================

export class CryptoUtils {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateToken(payload: object, secret: string, expiresIn = '24h'): string {
    return jwt.sign(payload, secret, { expiresIn });
  }

  static verifyToken<T = any>(token: string, secret: string): T {
    return jwt.verify(token, secret) as T;
  }

  static generateSecureId(size = 21): string {
    return nanoid(size);
  }

  static generateSlug(text: string): string {
    return slugify(text, {
      lower: true,
      strict: true,
      locale: 'it'
    });
  }
}

// ===========================================
// DATE & TIME UTILITIES
// ===========================================

export class DateUtils {
  static format(date: Date | string, format = 'DD/MM/YYYY'): string {
    return dayjs(date).format(format);
  }

  static formatRelative(date: Date | string): string {
    const now = dayjs();
    const targetDate = dayjs(date);
    const diffMinutes = now.diff(targetDate, 'minute');
    const diffHours = now.diff(targetDate, 'hour');
    const diffDays = now.diff(targetDate, 'day');

    if (diffMinutes < 1) return 'Ora';
    if (diffMinutes < 60) return `${diffMinutes} minuti fa`;
    if (diffHours < 24) return `${diffHours} ore fa`;
    if (diffDays < 30) return `${diffDays} giorni fa`;
    
    return targetDate.format('DD/MM/YYYY');
  }

  static isBusinessHour(date: Date = new Date()): boolean {
    const hour = dayjs(date).hour();
    const day = dayjs(date).day();
    return day >= 1 && day <= 5 && hour >= 9 && hour <= 18;
  }

  static addBusinessDays(date: Date, days: number): Date {
    let result = dayjs(date);
    let remainingDays = days;

    while (remainingDays > 0) {
      result = result.add(1, 'day');
      if (result.day() !== 0 && result.day() !== 6) {
        remainingDays--;
      }
    }

    return result.toDate();
  }

  static calculateAge(birthDate: Date): { years: number; months: number } {
    const now = dayjs();
    const birth = dayjs(birthDate);
    const years = now.diff(birth, 'year');
    const months = now.diff(birth.add(years, 'year'), 'month');
    return { years, months };
  }
}

// ===========================================
// GEOLOCATION UTILITIES
// ===========================================

export class GeoUtils {
  /**
   * Calculate distance between two points using Haversine formula
   * @param point1 First coordinate
   * @param point2 Second coordinate
   * @returns Distance in kilometers
   */
  static calculateDistance(point1: LocationPoint, point2: LocationPoint): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.latitude - point1.latitude);
    const dLon = this.toRadians(point2.longitude - point1.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.latitude)) * Math.cos(this.toRadians(point2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Find points within radius of a center point
   */
  static filterByRadius<T extends { coordinates: LocationPoint }>(
    points: T[],
    center: LocationPoint,
    radiusKm: number
  ): (T & { distance: number })[] {
    return points
      .map(point => ({
        ...point,
        distance: this.calculateDistance(center, point.coordinates)
      }))
      .filter(point => point.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * Generate bounding box for a point with radius
   */
  static getBoundingBox(center: LocationPoint, radiusKm: number) {
    const lat = center.latitude;
    const lon = center.longitude;
    const latDelta = radiusKm / 111.32; // 1 degree lat = ~111.32 km
    const lonDelta = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));

    return {
      north: lat + latDelta,
      south: lat - latDelta,
      east: lon + lonDelta,
      west: lon - lonDelta
    };
  }
}

// ===========================================
// VALIDATION UTILITIES
// ===========================================

export class ValidationUtils {
  static validateItalianPhone(phone: string): boolean {
    // Italian phone number validation
    const italianPhoneRegex = /^(\+39|0039|39)?[\s]?([0-9]{2,4})[\s]?([0-9]{6,8})$/;
    return italianPhoneRegex.test(phone);
  }

  static validateMicrochip(microchip: string): boolean {
    // ISO 11784/11785 standard (15 digits)
    return /^\d{15}$/.test(microchip);
  }

  static validateItalianPostalCode(postalCode: string): boolean {
    return /^\d{5}$/.test(postalCode);
  }

  static validateVeterinarianLicense(license: string): boolean {
    // Italian veterinarian license format (example)
    return /^VET\d{6}$/.test(license);
  }

  static sanitizeHtml(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '');
  }

  static isStrongPassword(password: string): boolean {
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongPasswordRegex.test(password);
  }
}

// ===========================================
// TRIAGE SYSTEM
// ===========================================

export class TriageSystem {
  private static questions: TriageQuestion[] = [
    {
      id: 'breathing_difficulty',
      question: 'Il cane ha difficoltà respiratorie?',
      type: 'boolean',
      weight: 10,
      category: 'symptoms'
    },
    {
      id: 'consciousness',
      question: 'Il cane è cosciente e reattivo?',
      type: 'boolean',
      weight: 9,
      category: 'symptoms'
    },
    {
      id: 'bleeding',
      question: 'È presente sanguinamento?',
      type: 'multiple',
      options: ['Nessuno', 'Lieve', 'Moderato', 'Grave'],
      weight: 8,
      category: 'symptoms'
    },
    {
      id: 'pain_level',
      question: 'Livello di dolore percepito (1-10)',
      type: 'scale',
      weight: 7,
      category: 'symptoms'
    },
    {
      id: 'vomiting',
      question: 'Ha vomitato nelle ultime 24 ore?',
      type: 'boolean',
      weight: 5,
      category: 'symptoms'
    },
    {
      id: 'appetite',
      question: 'Ha appetito normale?',
      type: 'boolean',
      weight: 4,
      category: 'behavior'
    },
    {
      id: 'mobility',
      question: 'Ha difficoltà a camminare?',
      type: 'boolean',
      weight: 6,
      category: 'symptoms'
    },
    {
      id: 'previous_issues',
      question: 'Ha avuto problemi simili in passato?',
      type: 'boolean',
      weight: 3,
      category: 'history'
    }
  ];

  static calculateTriageScore(responses: TriageResponse[]): TriageResult {
    let totalScore = 0;
    let maxPossibleScore = 0;

    this.questions.forEach(question => {
      maxPossibleScore += question.weight;
      const response = responses.find(r => r.questionId === question.id);
      
      if (!response) return;

      let score = 0;
      if (question.type === 'boolean') {
        if (question.id === 'consciousness' || question.id === 'appetite') {
          // Inverted scoring for positive questions
          score = response.answer === false ? question.weight : 0;
        } else {
          score = response.answer === true ? question.weight : 0;
        }
      } else if (question.type === 'scale') {
        score = ((response.answer as number) / 10) * question.weight;
      } else if (question.type === 'multiple') {
        const options = question.options || [];
        const answerIndex = options.indexOf(response.answer as string);
        score = (answerIndex / (options.length - 1)) * question.weight;
      }

      totalScore += score;
    });

    const normalizedScore = Math.round((totalScore / maxPossibleScore) * 100);
    
    let urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
    let recommendations: string[];
    let suggestedActions: string[];
    let veterinarianRequired: boolean;
    let emergencyServices: boolean;

    if (normalizedScore >= 80) {
      urgencyLevel = 'critical';
      recommendations = [
        'Contattare immediatamente i servizi di emergenza veterinaria',
        'Non spostare il cane se non necessario',
        'Mantenere il cane calmo e al caldo'
      ];
      suggestedActions = ['Chiamare emergenza veterinaria', 'Prepararsi al trasporto'];
      veterinarianRequired = true;
      emergencyServices = true;
    } else if (normalizedScore >= 60) {
      urgencyLevel = 'high';
      recommendations = [
        'Consultare un veterinario entro 2-4 ore',
        'Monitorare attentamente i sintomi',
        'Non somministrare farmaci senza consulto'
      ];
      suggestedActions = ['Prenotare visita urgente', 'Preparare documenti sanitari'];
      veterinarianRequired = true;
      emergencyServices = false;
    } else if (normalizedScore >= 30) {
      urgencyLevel = 'medium';
      recommendations = [
        'Consultare un veterinario entro 24-48 ore',
        'Tenere sotto osservazione',
        'Offrire acqua e cibo leggero se gradito'
      ];
      suggestedActions = ['Prenotare visita', 'Monitorare sintomi'];
      veterinarianRequired = true;
      emergencyServices = false;
    } else {
      urgencyLevel = 'low';
      recommendations = [
        'Situazione non urgente',
        'Continuare a monitorare',
        'Consultare il veterinario se i sintomi peggiorano'
      ];
      suggestedActions = ['Monitoraggio domestico', 'Consultazione opzionale'];
      veterinarianRequired = false;
      emergencyServices = false;
    }

    return {
      score: normalizedScore,
      urgencyLevel,
      recommendations,
      suggestedActions,
      veterinarianRequired,
      emergencyServices
    };
  }

  static getQuestions(): TriageQuestion[] {
    return this.questions;
  }
}

// ===========================================
// FOOD CALCULATOR
// ===========================================

export class FoodCalculator {
  static calculateDailyNeeds(
    weight: number,
    size: DogSize,
    activityLevel: ActivityLevel,
    age: number,
    isNeutered: boolean
  ): FoodCalculation {
    // Base Metabolic Rate calculation (RER = 70 × (weight in kg)^0.75)
    const baseMetabolicRate = 70 * Math.pow(weight, 0.75);
    
    // Activity multipliers
    const activityMultipliers: Record<ActivityLevel, number> = {
      low: 1.2,
      moderate: 1.4,
      high: 1.6,
      very_high: 1.8
    };

    // Age multipliers
    let ageMultiplier = 1.0;
    if (age < 12) ageMultiplier = 2.0; // Puppies need more calories
    else if (age > 84) ageMultiplier = 0.8; // Senior dogs need less

    // Neuter multiplier
    const neuterMultiplier = isNeutered ? 0.9 : 1.0;

    // Calculate daily calories
    const dailyCalories = Math.round(
      baseMetabolicRate * 
      activityMultipliers[activityLevel] * 
      ageMultiplier * 
      neuterMultiplier
    );

    // Average kibble has ~3500 calories per kg
    const caloriesPerGram = 3.5;
    const portionGrams = Math.round(dailyCalories / caloriesPerGram);

    // Feeding recommendations
    let feedingTimes: number;
    if (age < 6) feedingTimes = 4; // Puppies
    else if (age < 12) feedingTimes = 3; // Young dogs
    else feedingTimes = 2; // Adult dogs

    const portionPerMeal = Math.round(portionGrams / feedingTimes);

    // Generate recommendations
    const recommendations: string[] = [
      `Suddividere in ${feedingTimes} pasti al giorno`,
      'Fornire sempre acqua fresca',
      'Pesare regolarmente per monitorare il peso ideale'
    ];

    // Size-specific recommendations
    switch (size) {
      case DogSize.TINY:
      case DogSize.SMALL:
        recommendations.push('Usare crocchette di piccola taglia');
        break;
      case DogSize.LARGE:
      case DogSize.GIANT:
        recommendations.push('Evitare pasti troppo abbondanti per prevenire la torsione gastrica');
        break;
    }

    // Activity-specific recommendations
    if (activityLevel === 'very_high') {
      recommendations.push('Considerare integratori per cani sportivi');
    }

    // Warnings
    const warnings: string[] = [];
    if (weight > this.getIdealWeightRange(size).max) {
      warnings.push('Il cane appare sovrappeso - consultare il veterinario');
    } else if (weight < this.getIdealWeightRange(size).min) {
      warnings.push('Il cane appare sottopeso - consultare il veterinario');
    }

    return {
      dogId: '', // Will be filled by caller
      currentWeight: weight,
      idealWeight: this.getIdealWeightRange(size).ideal,
      activityLevel,
      age,
      isNeutered,
      dailyCalories,
      portionGrams,
      feedingTimes,
      portionPerMeal,
      recommendations,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  private static getIdealWeightRange(size: DogSize): { min: number; max: number; ideal: number } {
    switch (size) {
      case DogSize.TINY:
        return { min: 1, max: 5, ideal: 3 };
      case DogSize.SMALL:
        return { min: 5, max: 15, ideal: 10 };
      case DogSize.MEDIUM:
        return { min: 15, max: 30, ideal: 22 };
      case DogSize.LARGE:
        return { min: 30, max: 50, ideal: 40 };
      case DogSize.GIANT:
        return { min: 50, max: 90, ideal: 70 };
    }
  }
}

// ===========================================
// MATCHING ALGORITHM (TINDOG)
// ===========================================

export class MatchingAlgorithm {
  static calculateCompatibilityScore(dog1: any, dog2: any, user1: any, user2: any): number {
    let score = 0;
    const maxScore = 100;

    // Size compatibility (20 points)
    const sizeCompatibility = this.getSizeCompatibility(dog1.size, dog2.size);
    score += sizeCompatibility * 20;

    // Age compatibility (15 points)
    const ageCompatibility = this.getAgeCompatibility(dog1.birthDate, dog2.birthDate);
    score += ageCompatibility * 15;

    // Activity level compatibility (20 points)
    const activityCompatibility = this.getActivityCompatibility(dog1.activityLevel, dog2.activityLevel);
    score += activityCompatibility * 20;

    // Temperament compatibility (20 points)
    const temperamentCompatibility = this.getTemperamentCompatibility(dog1.temperament, dog2.temperament);
    score += temperamentCompatibility * 20;

    // Geographic proximity (15 points)
    if (user1.address?.coordinates && user2.address?.coordinates) {
      const distance = GeoUtils.calculateDistance(user1.address.coordinates, user2.address.coordinates);
      const proximityScore = Math.max(0, 1 - (distance / 50)); // 50km max distance
      score += proximityScore * 15;
    }

    // Gender compatibility (10 points)
    const genderScore = dog1.gender !== dog2.gender ? 1 : 0.7; // Different genders slightly preferred
    score += genderScore * 10;

    return Math.min(Math.round(score), maxScore);
  }

  private static getSizeCompatibility(size1: DogSize, size2: DogSize): number {
    const sizeOrder = [DogSize.TINY, DogSize.SMALL, DogSize.MEDIUM, DogSize.LARGE, DogSize.GIANT];
    const index1 = sizeOrder.indexOf(size1);
    const index2 = sizeOrder.indexOf(size2);
    const difference = Math.abs(index1 - index2);
    
    // Perfect match: same size = 1.0, adjacent sizes = 0.8, etc.
    return Math.max(0, 1 - (difference * 0.2));
  }

  private static getAgeCompatibility(birthDate1: Date, birthDate2: Date): number {
    const age1 = DateUtils.calculateAge(birthDate1).years;
    const age2 = DateUtils.calculateAge(birthDate2).years;
    const ageDifference = Math.abs(age1 - age2);
    
    // Best compatibility within 2 years
    if (ageDifference <= 2) return 1.0;
    if (ageDifference <= 4) return 0.7;
    if (ageDifference <= 6) return 0.4;
    return 0.1;
  }

  private static getActivityCompatibility(level1: ActivityLevel, level2: ActivityLevel): number {
    const activityOrder = [ActivityLevel.LOW, ActivityLevel.MODERATE, ActivityLevel.HIGH, ActivityLevel.VERY_HIGH];
    const index1 = activityOrder.indexOf(level1);
    const index2 = activityOrder.indexOf(level2);
    const difference = Math.abs(index1 - index2);
    
    return Math.max(0, 1 - (difference * 0.25));
  }

  private static getTemperamentCompatibility(temperament1: string[], temperament2: string[]): number {
    if (!temperament1.length || !temperament2.length) return 0.5;
    
    const commonTraits = temperament1.filter(trait => temperament2.includes(trait));
    const totalTraits = new Set([...temperament1, ...temperament2]).size;
    
    return commonTraits.length / totalTraits;
  }
}

// ===========================================
// FORMATTING UTILITIES
// ===========================================

export class FormatUtils {
  static formatCurrency(amount: number, currency = 'EUR', locale = 'it-IT'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency
    }).format(amount);
  }

  static formatPhone(phone: string): string {
    // Format Italian phone number
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('39')) {
      const number = cleaned.substring(2);
      return `+39 ${number.substring(0, 3)} ${number.substring(3)}`;
    }
    return phone;
  }

  static formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  static formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  }

  static truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  static capitalizeFirst(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  static formatBreed(breed: string): string {
    return breed
      .split(' ')
      .map(word => this.capitalizeFirst(word))
      .join(' ');
  }
}

// ===========================================
// API RESPONSE UTILITIES
// ===========================================

export class ApiUtils {
  static success<T>(data: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      ...(message && { message })
    };
  }

  static error(error: string, errors?: Record<string, string[]>): ApiResponse {
    return {
      success: false,
      error,
      ...(errors && { errors })
    };
  }

  static paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number
  ): ApiResponse<T[]> {
    return {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static validatePagination(page?: number, limit?: number) {
    const validatedPage = Math.max(1, page || 1);
    const validatedLimit = Math.min(100, Math.max(1, limit || 10));
    
    return {
      page: validatedPage,
      limit: validatedLimit,
      offset: (validatedPage - 1) * validatedLimit
    };
  }
}

// ===========================================
// NOTIFICATION UTILITIES
// ===========================================

export class NotificationUtils {
  static generateBookingConfirmation(booking: any, veterinarian: any): {
    title: string;
    message: string;
    data: any;
  } {
    return {
      title: 'Prenotazione Confermata',
      message: `La tua visita con ${veterinarian.clinicName} è confermata per il ${DateUtils.format(booking.scheduledAt, 'DD/MM/YYYY')} alle ${DateUtils.format(booking.scheduledAt, 'HH:mm')}`,
      data: {
        bookingId: booking.id,
        type: 'booking_confirmed'
      }
    };
  }

  static generateEmergencyAlert(emergency: any, distance: number): {
    title: string;
    message: string;
    data: any;
  } {
    const typeLabels = {
      lost_dog: 'Cane Smarrito',
      found_dog: 'Cane Trovato',
      injured_dog: 'Cane Ferito',
      abandoned_dog: 'Cane Abbandonato'
    };

    return {
      title: `🚨 ${typeLabels[emergency.type]}`,
      message: `${emergency.title} - A ${distance.toFixed(1)}km da te`,
      data: {
        emergencyId: emergency.id,
        type: 'emergency_alert',
        location: emergency.location
      }
    };
  }

  static generateMatchNotification(dog1: any, dog2: any, score: number): {
    title: string;
    message: string;
    data: any;
  } {
    return {
      title: '💖 Nuovo Match!',
      message: `${dog1.name} ha fatto match con ${dog2.name}! Compatibilità: ${score}%`,
      data: {
        matchScore: score,
        type: 'new_match'
      }
    };
  }
}

// ===========================================
// ERROR HANDLING UTILITIES
// ===========================================

export class ErrorUtils {
  static createAppError(
    message: string,
    statusCode: number,
    code?: string,
    details?: any
  ): Error & { statusCode: number; isOperational: boolean; code?: string; details?: any } {
    const error = new Error(message) as any;
    error.statusCode = statusCode;
    error.isOperational = true;
    error.code = code;
    error.details = details;
    return error;
  }

  static isOperationalError(error: any): boolean {
    return error.isOperational === true;
  }

  static formatValidationErrors(zodError: z.ZodError): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    
    zodError.errors.forEach(err => {
      const path = err.path.join('.');
      if (!errors[path]) errors[path] = [];
      errors[path].push(err.message);
    });

    return errors;
  }
}

// ===========================================
// SEARCH UTILITIES
// ===========================================

export class SearchUtils {
  static buildSearchQuery(
    query: string,
    fields: string[],
    fuzzy = true
  ): any {
    if (!query) return {};

    const searchTerms = query
      .toLowerCase()
      .split(' ')
      .filter(term => term.length > 0);

    if (fuzzy) {
      return {
        $or: fields.map(field => ({
          [field]: {
            $regex: searchTerms.join('|'),
            $options: 'i'
          }
        }))
      };
    }

    return {
      $or: fields.map(field => ({
        [field]: { $in: searchTerms }
      }))
    };
  }

  static highlightSearchTerms(text: string, query: string): string {
    if (!query) return text;

    const terms = query.split(' ').filter(term => term.length > 0);
    let highlightedText = text;

    terms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    });

    return highlightedText;
  }
}

// ===========================================
// CACHE UTILITIES
// ===========================================

export class CacheUtils {
  static generateKey(...parts: (string | number)[]): string {
    return parts.join(':');
  }

  static parseTTL(ttl: string | number): number {
    if (typeof ttl === 'number') return ttl;
    
    const units: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
      w: 604800
    };

    const match = ttl.match(/^(\d+)([smhdw])$/);
    if (!match) return 3600; // Default 1 hour

    const [, value, unit] = match;
    return parseInt(value) * units[unit];
  }
}

// ===========================================
// URL UTILITIES
// ===========================================

export class UrlUtils {
  static buildUrl(base: string, path: string, params?: Record<string, any>): string {
    const url = new URL(path, base);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    return url.toString();
  }

  static extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// ===========================================
// EXPORTS
// ===========================================

export {
  CryptoUtils,
  DateUtils,
  GeoUtils,
  ValidationUtils,
  TriageSystem,
  FoodCalculator,
  MatchingAlgorithm,
  FormatUtils,
  ApiUtils,
  NotificationUtils,
  ErrorUtils,
  SearchUtils,
  CacheUtils,
  UrlUtils
};

export default {
  CryptoUtils,
  DateUtils,
  GeoUtils,
  ValidationUtils,
  TriageSystem,
  FoodCalculator,
  MatchingAlgorithm,
  FormatUtils,
  ApiUtils,
  NotificationUtils,
  ErrorUtils,
  SearchUtils,
  CacheUtils,
  UrlUtils
};