import axios from 'axios';
import payload from 'payload';

export class VideoCallService {
  private apiKey: string;
  private domain: string;
  private baseURL: string;

  constructor() {
    this.apiKey = process.env.DAILY_API_KEY || '';
    this.domain = process.env.DAILY_DOMAIN || '';
    this.baseURL = 'https://api.daily.co/v1';

    if (!this.apiKey || !this.domain) {
      console.warn('Daily.co credentials not configured');
    }
  }

  async createRoom(
    bookingId: string,
    options: {
      privacy?: 'public' | 'private';
      maxParticipants?: number;
      enableChat?: boolean;
      enableRecording?: boolean;
      autoStartRecording?: boolean;
      meetingExpiresIn?: number; // seconds
    } = {}
  ): Promise<{
    url: string;
    roomName: string;
    token?: string;
  }> {
    if (!this.apiKey) {
      // Return mock data for development
      const roomName = `booking-${bookingId}-${Date.now()}`;
      return {
        url: `https://${this.domain}.daily.co/${roomName}`,
        roomName,
      };
    }

    try {
      const roomName = `booking-${bookingId}-${Date.now()}`;
      const expiresIn = options.meetingExpiresIn || 3600; // 1 hour default
      const expirationTime = Math.floor(Date.now() / 1000) + expiresIn;

      const roomConfig = {
        name: roomName,
        privacy: options.privacy || 'private',
        properties: {
          max_participants: options.maxParticipants || 2,
          enable_chat: options.enableChat !== false,
          enable_knocking: true,
          enable_screenshare: true,
          enable_recording: options.enableRecording || false,
          auto_start_recording: options.autoStartRecording || false,
          recording_layout_preset: 'single-participant',
          exp: expirationTime,
          eject_at_room_exp: true,
          lang: 'it',
        },
      };

      const response = await axios.post(
        `${this.baseURL}/rooms`,
        roomConfig,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const room = response.data;
      
      // Store room info in database
      await payload.create({
        collection: 'video-call-sessions',
        data: {
          booking: bookingId,
          dailyRoomUrl: room.url,
          dailyRoomName: room.name,
          participants: [],
          status: 'scheduled',
        },
      });

      payload.logger.info(`Video room created: ${room.name} for booking ${bookingId}`);

      return {
        url: room.url,
        roomName: room.name,
      };
    } catch (error) {
      payload.logger.error('Failed to create video room:', error);
      throw error;
    }
  }

  async generateMeetingToken(
    roomName: string,
    userId: string,
    userRole: 'veterinarian' | 'owner' = 'owner',
    expiresIn: number = 3600
  ): Promise<string> {
    if (!this.apiKey) {
      // Return mock token for development
      return `mock-token-${userId}-${roomName}`;
    }

    try {
      const expirationTime = Math.floor(Date.now() / 1000) + expiresIn;

      const tokenConfig = {
        properties: {
          room_name: roomName,
          user_id: userId,
          exp: expirationTime,
          is_owner: userRole === 'veterinarian',
          enable_recording: userRole === 'veterinarian',
          start_video_off: false,
          start_audio_off: false,
        },
      };

      const response = await axios.post(
        `${this.baseURL}/meeting-tokens`,
        tokenConfig,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.token;
    } catch (error) {
      payload.logger.error('Failed to generate meeting token:', error);
      throw error;
    }
  }

  async startCall(bookingId: string): Promise<{
    roomUrl: string;
    veterinarianToken: string;
    ownerToken: string;
  }> {
    try {
      // Get booking details
      const booking = await payload.findByID({
        collection: 'bookings',
        id: bookingId,
        populate: ['user', 'veterinarian'],
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Get or create video call session
      let session = await payload.find({
        collection: 'video-call-sessions',
        where: {
          booking: { equals: bookingId },
        },
        limit: 1,
      });

      let roomUrl: string;
      let roomName: string;

      if (session.docs.length === 0) {
        // Create new room
        const room = await this.createRoom(bookingId, {
          privacy: 'private',
          maxParticipants: 2,
          enableRecording: true,
          meetingExpiresIn: 5400, // 1.5 hours
        });

        roomUrl = room.url;
        roomName = room.roomName;
      } else {
        const existingSession = session.docs[0];
        roomUrl = existingSession.dailyRoomUrl;
        roomName = existingSession.dailyRoomName;
      }

      // Generate tokens for both participants
      const veterinarianToken = await this.generateMeetingToken(
        roomName,
        booking.veterinarian.user.id,
        'veterinarian'
      );

      const ownerToken = await this.generateMeetingToken(
        roomName,
        booking.user.id,
        'owner'
      );

      // Update booking status
      await payload.update({
        collection: 'bookings',
        id: bookingId,
        data: {
          status: 'in_progress',
          videoCallUrl: roomUrl,
          videoCallStarted: new Date(),
        },
      });

      return {
        roomUrl,
        veterinarianToken,
        ownerToken,
      };
    } catch (error) {
      payload.logger.error('Failed to start call:', error);
      throw error;
    }
  }

  async endCall(bookingId: string): Promise<void> {
    try {
      // Get video call session
      const session = await payload.find({
        collection: 'video-call-sessions',
        where: {
          booking: { equals: bookingId },
        },
        limit: 1,
      });

      if (session.docs.length === 0) {
        throw new Error('Video call session not found');
      }

      const callSession = session.docs[0];

      // Delete room from Daily.co
      if (this.apiKey) {
        try {
          await axios.delete(
            `${this.baseURL}/rooms/${callSession.dailyRoomName}`,
            {
              headers: {
                'Authorization': `Bearer ${this.apiKey}`,
              },
            }
          );
        } catch (deleteError) {
          payload.logger.warn('Failed to delete Daily.co room:', deleteError);
        }
      }

      // Update session status
      await payload.update({
        collection: 'video-call-sessions',
        id: callSession.id,
        data: {
          status: 'ended',
          endedAt: new Date(),
        },
      });

      // Update booking
      await payload.update({
        collection: 'bookings',
        id: bookingId,
        data: {
          videoCallEnded: new Date(),
        },
      });

      payload.logger.info(`Video call ended for booking ${bookingId}`);
    } catch (error) {
      payload.logger.error('Failed to end call:', error);
      throw error;
    }
  }

  async getRoomInfo(roomName: string): Promise<any> {
    if (!this.apiKey) {
      return {
        name: roomName,
        participants: [],
        status: 'active',
      };
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/rooms/${roomName}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      payload.logger.error('Failed to get room info:', error);
      throw error;
    }
  }

  async getCallRecording(bookingId: string): Promise<string | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const session = await payload.find({
        collection: 'video-call-sessions',
        where: {
          booking: { equals: bookingId },
        },
        limit: 1,
      });

      if (session.docs.length === 0) {
        return null;
      }

      const callSession = session.docs[0];

      // Get recordings for the room
      const response = await axios.get(
        `${this.baseURL}/recordings`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          params: {
            room_name: callSession.dailyRoomName,
          },
        }
      );

      const recordings = response.data.data;
      if (recordings.length === 0) {
        return null;
      }

      // Return the most recent recording
      const latestRecording = recordings[0];
      return latestRecording.download_link;
    } catch (error) {
      payload.logger.error('Failed to get call recording:', error);
      return null;
    }
  }

  async handleWebhook(event: any): Promise<void> {
    try {
      const { type, payload: eventPayload } = event;

      switch (type) {
        case 'room.participant-joined':
          await this.handleParticipantJoined(eventPayload);
          break;

        case 'room.participant-left':
          await this.handleParticipantLeft(eventPayload);
          break;

        case 'recording.started':
          await this.handleRecordingStarted(eventPayload);
          break;

        case 'recording.finished':
          await this.handleRecordingFinished(eventPayload);
          break;

        default:
          payload.logger.info(`Unhandled Daily.co webhook event: ${type}`);
      }
    } catch (error) {
      payload.logger.error('Failed to handle Daily.co webhook:', error);
    }
  }

  private async handleParticipantJoined(eventPayload: any): Promise<void> {
    const { room, participant } = eventPayload;

    // Find session by room name
    const session = await payload.find({
      collection: 'video-call-sessions',
      where: {
        dailyRoomName: { equals: room.name },
      },
      limit: 1,
    });

    if (session.docs.length === 0) {
      return;
    }

    const callSession = session.docs[0];
    const participants = Array.isArray(callSession.participants) ? callSession.participants : [];

    // Add participant
    participants.push({
      userId: participant.user_id || participant.id,
      joinedAt: new Date(),
    });

    await payload.update({
      collection: 'video-call-sessions',
      id: callSession.id,
      data: {
        participants,
        status: 'active',
      },
    });

    payload.logger.info(`Participant joined room ${room.name}: ${participant.user_id}`);
  }

  private async handleParticipantLeft(eventPayload: any): Promise<void> {
    const { room, participant } = eventPayload;

    const session = await payload.find({
      collection: 'video-call-sessions',
      where: {
        dailyRoomName: { equals: room.name },
      },
      limit: 1,
    });

    if (session.docs.length === 0) {
      return;
    }

    const callSession = session.docs[0];
    const participants = Array.isArray(callSession.participants) ? callSession.participants : [];

    // Update participant with left time
    const updatedParticipants = participants.map((p: any) => {
      if (p.userId === (participant.user_id || participant.id)) {
        return {
          ...p,
          leftAt: new Date(),
          duration: Date.now() - new Date(p.joinedAt).getTime(),
        };
      }
      return p;
    });

    await payload.update({
      collection: 'video-call-sessions',
      id: callSession.id,
      data: {
        participants: updatedParticipants,
      },
    });

    payload.logger.info(`Participant left room ${room.name}: ${participant.user_id}`);
  }

  private async handleRecordingStarted(eventPayload: any): Promise<void> {
    payload.logger.info(`Recording started for room ${eventPayload.room.name}`);
  }

  private async handleRecordingFinished(eventPayload: any): Promise<void> {
    const { room, recording } = eventPayload;

    const session = await payload.find({
      collection: 'video-call-sessions',
      where: {
        dailyRoomName: { equals: room.name },
      },
      limit: 1,
    });

    if (session.docs.length > 0) {
      await payload.update({
        collection: 'video-call-sessions',
        id: session.docs[0].id,
        data: {
          recordingUrl: recording.download_link,
        },
      });

      payload.logger.info(`Recording finished for room ${room.name}: ${recording.download_link}`);
    }
  }

  async getCallStats(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      const sessions = await payload.find({
        collection: 'video-call-sessions',
        where: {
          createdAt: { greater_than_equal: startDate.toISOString() },
        },
      });

      const stats = {
        totalCalls: sessions.totalDocs,
        completedCalls: 0,
        averageDuration: 0,
        totalMinutes: 0,
      };

      let totalDuration = 0;
      let completedCount = 0;

              sessions.docs.forEach((session: any) => {
          if (session.status === 'ended' && session.startedAt && session.endedAt) {
            const duration = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
            totalDuration += duration;
            completedCount++;
          }
        });

        stats.completedCalls = completedCount;
        stats.averageDuration = completedCount > 0 ? Math.round(totalDuration / completedCount / 1000 / 60) : 0; // minutes
        stats.totalMinutes = Math.round(totalDuration / 1000 / 60);

        return stats;
      } catch (error) {
        payload.logger.error('Failed to get call stats:', error);
        return {
          totalCalls: 0,
          completedCalls: 0,
          averageDuration: 0,
          totalMinutes: 0,
        };
      }
    }
  }