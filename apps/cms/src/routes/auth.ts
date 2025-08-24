import express from 'express';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import payload from 'payload';
import { CryptoUtils } from '@doggo/utils';

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour per IP
  message: { error: 'Too many registration attempts, please try again later.' },
});

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(1).max(50).required(),
  lastName: Joi.string().min(1).max(50).required(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
  role: Joi.string().valid('user', 'veterinarian', 'shelter').default('user'),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required(),
});

const verifyEmailSchema = Joi.object({
  token: Joi.string().required(),
});

// Register endpoint
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(d => d.message),
      });
    }

    const { email, password, firstName, lastName, phone, role } = value;

    // Check if user already exists
    const existingUser = await payload.find({
      collection: 'users',
      where: {
        email: { equals: email },
      },
      limit: 1,
    });

    if (existingUser.docs.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists',
      });
    }

    // Create user
    const user = await payload.create({
      collection: 'users',
      data: {
        email,
        password, // Will be hashed by the beforeChange hook
        firstName,
        lastName,
        phone,
        role,
        isVerified: false,
        isActive: true,
      },
    });

    // Send welcome email
    try {
      const emailService = req.app.locals.services.email;
      await emailService.sendWelcomeEmail(user);
    } catch (emailError) {
      payload.logger.error('Failed to send welcome email:', emailError);
    }

    // Generate verification token
    const verificationToken = CryptoUtils.generateSecureId(32);
    
    // Store verification token (in production, use Redis with expiration)
    await payload.create({
      collection: 'user-tokens',
      data: {
        userId: user.id,
        token: verificationToken,
        type: 'email_verification',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Send verification email
    try {
      const emailService = req.app.locals.services.email;
      const verificationUrl = `${process.env.NEXTAUTH_URL}/verify?token=${verificationToken}`;
      await emailService.sendVerificationEmail(user, verificationUrl);
    } catch (emailError) {
      payload.logger.error('Failed to send verification email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for verification.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    payload.logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
    });
  }
});

// Login endpoint
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(d => d.message),
      });
    }

    const { email, password } = value;

    // Find user
    const users = await payload.find({
      collection: 'users',
      where: {
        email: { equals: email },
        isActive: { equals: true },
      },
      limit: 1,
    });

    if (users.docs.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    const user = users.docs[0];

    // Verify password
    const isPasswordValid = await CryptoUtils.comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Generate JWT token
    const token = CryptoUtils.generateToken(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET!,
      '7d'
    );

    // Update last login
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        lastLogin: new Date(),
        loginCount: (user.loginCount || 0) + 1,
      },
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isVerified: user.isVerified,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    payload.logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
    });
  }
});

// Forgot password endpoint
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { error, value } = forgotPasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(d => d.message),
      });
    }

    const { email } = value;

    // Find user
    const users = await payload.find({
      collection: 'users',
      where: {
        email: { equals: email },
        isActive: { equals: true },
      },
      limit: 1,
    });

    // Always return success to prevent email enumeration
    if (users.docs.length === 0) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    const user = users.docs[0];

    // Generate reset token
    const resetToken = CryptoUtils.generateSecureId(32);
    
    // Store reset token
    await payload.create({
      collection: 'user-tokens',
      data: {
        userId: user.id,
        token: resetToken,
        type: 'password_reset',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Send reset email
    try {
      const emailService = req.app.locals.services.email;
      const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`;
      await emailService.sendPasswordReset(user, resetUrl);
    } catch (emailError) {
      payload.logger.error('Failed to send password reset email:', emailError);
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    payload.logger.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request',
    });
  }
});

// Reset password endpoint
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { error, value } = resetPasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(d => d.message),
      });
    }

    const { token, password } = value;

    // Find valid token
    const tokens = await payload.find({
      collection: 'user-tokens',
      where: {
        token: { equals: token },
        type: { equals: 'password_reset' },
        expiresAt: { greater_than: new Date() },
        used: { not_equals: true },
      },
      limit: 1,
    });

    if (tokens.docs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
      });
    }

    const resetToken = tokens.docs[0];

    // Update user password
    await payload.update({
      collection: 'users',
      id: resetToken.userId,
      data: {
        password, // Will be hashed by the beforeChange hook
      },
    });

    // Mark token as used
    await payload.update({
      collection: 'user-tokens',
      id: resetToken.id,
      data: {
        used: true,
        usedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    payload.logger.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password',
    });
  }
});

// Verify email endpoint
router.post('/verify', async (req, res) => {
  try {
    const { error, value } = verifyEmailSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(d => d.message),
      });
    }

    const { token } = value;

    // Find valid token
    const tokens = await payload.find({
      collection: 'user-tokens',
      where: {
        token: { equals: token },
        type: { equals: 'email_verification' },
        expiresAt: { greater_than: new Date() },
        used: { not_equals: true },
      },
      limit: 1,
    });

    if (tokens.docs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token',
      });
    }

    const verificationToken = tokens.docs[0];

    // Update user as verified
    await payload.update({
      collection: 'users',
      id: verificationToken.userId,
      data: {
        isVerified: true,
      },
    });

    // Mark token as used
    await payload.update({
      collection: 'user-tokens',
      id: verificationToken.id,
      data: {
        used: true,
        usedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    payload.logger.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify email',
    });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token required',
      });
    }

    // Verify refresh token
    const decoded = CryptoUtils.verifyToken(refreshToken, process.env.JWT_SECRET!);
    
    // Get user
    const user = await payload.findByID({
      collection: 'users',
      id: decoded.userId,
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid user',
      });
    }

    // Generate new access token
    const newToken = CryptoUtils.generateToken(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET!,
      '7d'
    );

    res.json({
      success: true,
      token: newToken,
    });
  } catch (error) {
    payload.logger.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token',
    });
  }
});

// Logout endpoint (for token blacklisting in production)
router.post('/logout', async (req, res) => {
  // In production, implement token blacklisting with Redis
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

export default router;