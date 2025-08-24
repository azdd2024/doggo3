import type { CollectionConfig } from 'payload/types';
import { isAdmin, isMatchParticipantOrAdmin } from '../access/index';

export const Matches: CollectionConfig = {
  slug: 'matches',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['dog1', 'dog2', 'status', 'matchScore', 'matchedAt'],
    group: 'Social',
  },
  access: {
    create: ({ req: { user } }) => !!user,
    read: isMatchParticipantOrAdmin,
    update: isMatchParticipantOrAdmin,
    delete: isAdmin,
    admin: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'dog1',
      type: 'relationship',
      relationTo: 'dogs',
      required: true,
      label: 'Cane 1',
    },
    {
      name: 'dog2',
      type: 'relationship',
      relationTo: 'dogs',
      required: true,
      label: 'Cane 2',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      label: 'Stato',
      options: [
        {
          label: '⏳ In Attesa',
          value: 'pending',
        },
        {
          label: '💖 Match!',
          value: 'matched',
        },
        {
          label: '❌ Rifiutato',
          value: 'rejected',
        },
        {
          label: '💬 In Chat',
          value: 'chatting',
        },
        {
          label: '📅 Incontro Pianificato',
          value: 'meeting_planned',
        },
      ],
      defaultValue: 'pending',
    },
    {
      name: 'matchScore',
      type: 'number',
      required: true,
      label: 'Punteggio Compatibilità (%)',
      min: 0,
      max: 100,
      admin: {
        description: 'Calcolato automaticamente dall\'algoritmo di matching',
        readOnly: true,
      },
    },
    {
      name: 'user1Action',
      type: 'select',
      required: true,
      label: 'Azione Utente 1',
      options: [
        { label: 'In Attesa', value: 'pending' },
        { label: 'Mi Piace', value: 'liked' },
        { label: 'Non Interessato', value: 'passed' },
      ],
      defaultValue: 'pending',
    },
    {
      name: 'user2Action',
      type: 'select',
      required: true,
      label: 'Azione Utente 2',
      options: [
        { label: 'In Attesa', value: 'pending' },
        { label: 'Mi Piace', value: 'liked' },
        { label: 'Non Interessato', value: 'passed' },
      ],
      defaultValue: 'pending',
    },
    {
      name: 'chat',
      type: 'relationship',
      relationTo: 'chats',
      label: 'Chat',
      admin: {
        condition: (data) => data?.status === 'matched' || data?.status === 'chatting',
        description: 'Chat creata automaticamente quando c\'è un match',
      },
    },
    {
      name: 'matchedAt',
      type: 'date',
      label: 'Match Creato il',
      admin: {
        condition: (data) => data?.status === 'matched' || data?.status === 'chatting' || data?.status === 'meeting_planned',
        date: {
          pickerAppearance: 'dayAndTime',
        },
        readOnly: true,
      },
    },
    {
      name: 'meetingPlannedAt',
      type: 'date',
      label: 'Incontro Pianificato',
      admin: {
        condition: (data) => data?.status === 'meeting_planned',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'meetingLocation',
      type: 'text',
      label: 'Luogo Incontro',
      admin: {
        condition: (data) => data?.status === 'meeting_planned',
        placeholder: 'Es. Parco di Villa Borghese, Roma',
      },
    },
    {
      name: 'meetingNotes',
      type: 'textarea',
      label: 'Note Incontro',
      admin: {
        condition: (data) => data?.status === 'meeting_planned',
        rows: 2,
        description: 'Note aggiuntive per l\'incontro pianificato',
      },
    },
    {
      name: 'feedback',
      type: 'group',
      label: 'Feedback Post-Incontro',
      admin: {
        condition: (data) => data?.status === 'meeting_planned',
      },
      fields: [
        {
          name: 'user1Rating',
          type: 'number',
          label: 'Valutazione Utente 1',
          min: 1,
          max: 5,
        },
        {
          name: 'user1Comments',
          type: 'textarea',
          label: 'Commenti Utente 1',
          admin: { rows: 2 },
        },
        {
          name: 'user2Rating',
          type: 'number',
          label: 'Valutazione Utente 2',
          min: 1,
          max: 5,
        },
        {
          name: 'user2Comments',
          type: 'textarea',
          label: 'Commenti Utente 2',
          admin: { rows: 2 },
        },
        {
          name: 'dogsCompatible',
          type: 'checkbox',
          label: 'Cani Compatibili',
        },
        {
          name: 'futurePlaydates',
          type: 'checkbox',
          label: 'Futuri Incontri Pianificati',
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      // Validate unique dog pairing
      async ({ req, operation, data, originalDoc }) => {
        if (operation === 'create') {
          const existingMatch = await req.payload.find({
            collection: 'matches',
            where: {
              or: [
                { dog1: { equals: data.dog1 }, dog2: { equals: data.dog2 } },
                { dog1: { equals: data.dog2 }, dog2: { equals: data.dog1 } },
              ],
            },
            limit: 1,
          });

          if (existingMatch.docs.length > 0) {
            throw new Error('Match between these dogs already exists');
          }
        }
        return data;
      },
      // Auto-calculate match score if not provided
      async ({ req, data, operation }) => {
        if (operation === 'create' && !data.matchScore) {
          try {
            const [dog1, dog2] = await Promise.all([
              req.payload.findByID({
                collection: 'dogs',
                id: data.dog1,
                populate: ['owner'],
              }),
              req.payload.findByID({
                collection: 'dogs',
                id: data.dog2,
                populate: ['owner'],
              }),
            ]);

            const { MatchingAlgorithm } = await import('@doggo/utils');
            data.matchScore = MatchingAlgorithm.calculateCompatibilityScore(
              dog1,
              dog2,
              dog1.owner,
              dog2.owner
            );
          } catch (error) {
            payload.logger.error('Failed to calculate match score:', error);
            data.matchScore = 50; // Default score
          }
        }
        return data;
      },
      // Auto-update status based on actions
      async ({ data, originalDoc }) => {
        if (data.user1Action && data.user2Action) {
          if (data.user1Action === 'liked' && data.user2Action === 'liked') {
            data.status = 'matched';
            if (!originalDoc?.matchedAt) {
              data.matchedAt = new Date();
            }
          } else if (data.user1Action === 'passed' || data.user2Action === 'passed') {
            data.status = 'rejected';
          }
        }
        return data;
      },
    ],
    afterChange: [
      // Create chat when match is confirmed
      async ({ req, operation, doc, previousDoc }) => {
        if (operation === 'update' && doc.status === 'matched' && previousDoc?.status !== 'matched') {
          try {
            // Get dog owners
            const [dog1, dog2] = await Promise.all([
              req.payload.findByID({
                collection: 'dogs',
                id: doc.dog1,
                populate: ['owner'],
              }),
              req.payload.findByID({
                collection: 'dogs',
                id: doc.dog2,
                populate: ['owner'],
              }),
            ]);

            // Create chat
            const chat = await req.payload.create({
              collection: 'chats',
              data: {
                type: 'direct',
                title: `${dog1.name} & ${dog2.name}`,
              },
            });

            // Add participants
            await Promise.all([
              req.payload.create({
                collection: 'chat-participants',
                data: {
                  chat: chat.id,
                  user: dog1.owner.id,
                  role: 'member',
                },
              }),
              req.payload.create({
                collection: 'chat-participants',
                data: {
                  chat: chat.id,
                  user: dog2.owner.id,
                  role: 'member',
                },
              }),
            ]);

            // Update match with chat reference
            await req.payload.update({
              collection: 'matches',
              id: doc.id,
              data: {
                chat: chat.id,
              },
            });

            // Send notifications
            const notificationService = req.app?.locals?.services?.notification;
            if (notificationService) {
              await Promise.all([
                notificationService.sendNewMatch(dog1.owner, dog1, dog2, doc.matchScore),
                notificationService.sendNewMatch(dog2.owner, dog2, dog1, doc.matchScore),
              ]);
            }

            payload.logger.info(`Match created between ${dog1.name} and ${dog2.name}`);
          } catch (error) {
            payload.logger.error('Failed to create chat for match:', error);
          }
        }
      },
    ],
  ],
  endpoints: [
    {
      path: '/my-matches',
      method: 'get',
      handler: async (req, res) => {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
          });
        }

        try {
          const match = await req.payload.findByID({
            collection: 'matches',
            id,
            populate: ['dog1', 'dog2'],
          });

          if (!match) {
            return res.status(404).json({
              success: false,
              error: 'Match not found',
            });
          }

          // Check if user is participant in this match
          const userDogs = await req.payload.find({
            collection: 'dogs',
            where: {
              owner: { equals: req.user.id },
            },
          });

          const userDogIds = userDogs.docs.map((dog: any) => dog.id);
          const isParticipant = userDogIds.includes(match.dog1.id) || userDogIds.includes(match.dog2.id);

          if (!isParticipant && req.user.role !== 'admin') {
            return res.status(403).json({
              success: false,
              error: 'Access denied',
            });
          }

          if (match.status !== 'matched' && match.status !== 'chatting') {
            return res.status(400).json({
              success: false,
              error: 'Can only plan meetings for confirmed matches',
            });
          }

          const updatedMatch = await req.payload.update({
            collection: 'matches',
            id,
            data: {
              status: 'meeting_planned',
              meetingPlannedAt: new Date(meetingDate),
              meetingLocation: location,
              meetingNotes: notes,
            },
          });

          // Send notification to other participant
          const otherOwnerId = userDogIds.includes(match.dog1.id) ? match.dog2.owner.id : match.dog1.owner.id;
          const notificationService = req.app?.locals?.services?.notification;
          
          if (notificationService) {
            await notificationService.sendNotification(
              otherOwnerId,
              'meeting_planned',
              'Incontro Pianificato',
              `È stato pianificato un incontro per ${new Date(meetingDate).toLocaleDateString('it-IT')} presso ${location}`,
              {
                matchId: id,
                meetingDate,
                location,
              }
            );
          }

          res.json({
            success: true,
            match: updatedMatch,
          });
        } catch (error) {
          payload.logger.error('Plan meeting error:', error);
          res.status(500).json({
            success: false,
            error: 'Failed to plan meeting',
          });
        }
      },
    },
    {
      path: '/:id/feedback',
      method: 'post',
      handler: async (req, res) => {
        const { id } = req.params;
        const { rating, comments, dogsCompatible, futurePlaydates } = req.body;

        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
          });
        }

        try {
          const match = await req.payload.findByID({
            collection: 'matches',
            id,
            populate: ['dog1', 'dog2'],
          });

          if (!match) {
            return res.status(404).json({
              success: false,
              error: 'Match not found',
            });
          }

          // Check if user is participant
          const userDogs = await req.payload.find({
            collection: 'dogs',
            where: {
              owner: { equals: req.user.id },
            },
          });

          const userDogIds = userDogs.docs.map((dog: any) => dog.id);
          const isUser1 = userDogIds.includes(match.dog1.id);
          const isUser2 = userDogIds.includes(match.dog2.id);

          if (!isUser1 && !isUser2 && req.user.role !== 'admin') {
            return res.status(403).json({
              success: false,
              error: 'Access denied',
            });
          }

          // Update feedback
          const feedbackField = isUser1 ? 'user1' : 'user2';
          const currentFeedback = match.feedback || {};

          const updatedMatch = await req.payload.update({
            collection: 'matches',
            id,
            data: {
              feedback: {
                ...currentFeedback,
                [`${feedbackField}Rating`]: rating,
                [`${feedbackField}Comments`]: comments,
                dogsCompatible: dogsCompatible !== undefined ? dogsCompatible : currentFeedback.dogsCompatible,
                futurePlaydates: futurePlaydates !== undefined ? futurePlaydates : currentFeedback.futurePlaydates,
              },
            },
          });

          res.json({
            success: true,
            match: updatedMatch,
          });
        } catch (error) {
          payload.logger.error('Match feedback error:', error);
          res.status(500).json({
            success: false,
            error: 'Failed to submit feedback',
          });
        }
      },
    },
  ],
};user) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
          });
        }

        try {
          // Get user's dogs
          const userDogs = await req.payload.find({
            collection: 'dogs',
            where: {
              owner: { equals: req.user.id },
            },
          });

          const dogIds = userDogs.docs.map((dog: any) => dog.id);

          if (dogIds.length === 0) {
            return res.json({
              success: true,
              matches: [],
            });
          }

          // Get matches involving user's dogs
          const matches = await req.payload.find({
            collection: 'matches',
            where: {
              or: [
                { dog1: { in: dogIds } },
                { dog2: { in: dogIds } },
              ],
            },
            populate: ['dog1', 'dog2', 'chat'],
            sort: '-matchedAt',
            limit: 50,
          });

          res.json({
            success: true,
            matches: matches.docs,
          });
        } catch (error) {
          payload.logger.error('My matches fetch error:', error);
          res.status(500).json({
            success: false,
            error: 'Failed to fetch matches',
          });
        }
      },
    },
    {
      path: '/potential/:dogId',
      method: 'get',
      handler: async (req, res) => {
        const { dogId } = req.params;
        const { limit = 10 } = req.query;

        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
          });
        }

        try {
          // Verify dog ownership
          const dog = await req.payload.findByID({
            collection: 'dogs',
            id: dogId,
            populate: ['owner'],
          });

          if (dog.owner.id !== req.user.id) {
            return res.status(403).json({
              success: false,
              error: 'Access denied',
            });
          }

          // Get potential matches
          const { db } = await import('@doggo/database');
          const potentialMatches = await db.findPotentialMatches(dogId);

          // Calculate compatibility scores
          const { MatchingAlgorithm } = await import('@doggo/utils');
          const matchesWithScores = potentialMatches
            .map(matchDog => ({
              dog: matchDog,
              compatibilityScore: MatchingAlgorithm.calculateCompatibilityScore(
                dog,
                matchDog,
                dog.owner,
                matchDog.owner
              ),
            }))
            .filter(match => match.compatibilityScore >= 60)
            .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
            .slice(0, Number(limit));

          res.json({
            success: true,
            potentialMatches: matchesWithScores,
          });
        } catch (error) {
          payload.logger.error('Potential matches error:', error);
          res.status(500).json({
            success: false,
            error: 'Failed to find potential matches',
          });
        }
      },
    },
    {
      path: '/action',
      method: 'post',
      handler: async (req, res) => {
        const { dog1Id, dog2Id, action } = req.body;

        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
          });
        }

        if (!dog1Id || !dog2Id || !['like', 'pass'].includes(action)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid parameters',
          });
        }

        try {
          // Verify dog ownership
          const dog1 = await req.payload.findByID({
            collection: 'dogs',
            id: dog1Id,
          });

          if (dog1.owner !== req.user.id) {
            return res.status(403).json({
              success: false,
              error: 'Access denied',
            });
          }

          // Find or create match
          let match = await req.payload.find({
            collection: 'matches',
            where: {
              or: [
                { dog1: { equals: dog1Id }, dog2: { equals: dog2Id } },
                { dog1: { equals: dog2Id }, dog2: { equals: dog1Id } },
              ],
            },
            limit: 1,
          });

          const isReverse = match.docs.length > 0 && match.docs[0].dog1 === dog2Id;
          const actionField = isReverse ? 'user2Action' : 'user1Action';

          if (match.docs.length === 0) {
            // Create new match
            const dog2 = await req.payload.findByID({
              collection: 'dogs',
              id: dog2Id,
              populate: ['owner'],
            });

            const { MatchingAlgorithm } = await import('@doggo/utils');
            const matchScore = MatchingAlgorithm.calculateCompatibilityScore(
              dog1,
              dog2,
              { id: req.user.id },
              dog2.owner
            );

            const newMatch = await req.payload.create({
              collection: 'matches',
              data: {
                dog1: dog1Id,
                dog2: dog2Id,
                matchScore,
                [actionField]: action === 'like' ? 'liked' : 'passed',
                status: 'pending',
              },
            });

            return res.json({
              success: true,
              match: newMatch,
              isMatch: false,
            });
          }

          // Update existing match
          const existingMatch = match.docs[0];
          const otherAction = isReverse ? existingMatch.user1Action : existingMatch.user2Action;

          const updateData: any = {
            [actionField]: action === 'like' ? 'liked' : 'passed',
          };

          let isMatch = false;
          if (action === 'like' && otherAction === 'liked') {
            updateData.status = 'matched';
            updateData.matchedAt = new Date();
            isMatch = true;
          } else if (action === 'pass' || otherAction === 'passed') {
            updateData.status = 'rejected';
          }

          const updatedMatch = await req.payload.update({
            collection: 'matches',
            id: existingMatch.id,
            data: updateData,
          });

          res.json({
            success: true,
            match: updatedMatch,
            isMatch,
          });
        } catch (error) {
          payload.logger.error('Match action error:', error);
          res.status(500).json({
            success: false,
            error: 'Failed to process match action',
          });
        }
      },
    },
    {
      path: '/:id/plan-meeting',
      method: 'patch',
      handler: async (req, res) => {
        const { id } = req.params;
        const { meetingDate, location, notes } = req.body;

        if (!req.