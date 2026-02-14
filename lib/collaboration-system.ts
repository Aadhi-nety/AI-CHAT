export interface CollaborationSession {
  sessionId: string;
  labId: string;
  participants: CollaborationParticipant[];
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface CollaborationParticipant {
  userId: string;
  username: string;
  email: string;
  joinedAt: Date;
  isHost: boolean;
  cursorPosition?: { x: number; y: number };
  currentStep: number;
}

export interface CollaborationEvent {
  type: 'user-joined' | 'user-left' | 'command-executed' | 'step-completed' | 'cursor-moved' | 'message-sent';
  userId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export class CollaborationManager {
  private sessions: Map<string, CollaborationSession> = new Map();
  private eventListeners: Map<string, CollaborationEvent[]> = new Map();

  createSession(labId: string, userId: string, username: string, email: string): CollaborationSession {
    const sessionId = `collab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const session: CollaborationSession = {
      sessionId,
      labId,
      participants: [
        {
          userId,
          username,
          email,
          joinedAt: new Date(),
          isHost: true,
          currentStep: 0,
        },
      ],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
      isActive: true,
    };
    this.sessions.set(sessionId, session);
    this.eventListeners.set(sessionId, []);
    return session;
  }

  joinSession(sessionId: string, userId: string, username: string, email: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) return false;

    session.participants.push({
      userId,
      username,
      email,
      joinedAt: new Date(),
      isHost: false,
      currentStep: 0,
    });

    this.recordEvent(sessionId, {
      type: 'user-joined',
      userId,
      timestamp: new Date(),
      data: { username, email },
    });

    return true;
  }

  recordEvent(sessionId: string, event: CollaborationEvent): void {
    const events = this.eventListeners.get(sessionId);
    if (events) events.push(event);
  }

  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionEvents(sessionId: string): CollaborationEvent[] {
    return this.eventListeners.get(sessionId) || [];
  }

  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
    }
  }

  getUserActiveSessions(userId: string): CollaborationSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.isActive && s.participants.some((p) => p.userId === userId)
    );
  }
}

export const collaborationManager = new CollaborationManager();
