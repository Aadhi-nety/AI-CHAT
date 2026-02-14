export interface LabProgress {
  labId: string;
  userId: string;
  startedAt: Date;
  completedAt?: Date;
  isCompleted: boolean;
  timeSpentMinutes: number;
  commandsAttempted: number;
  commandsSuccessful: number;
  hintsUsed: number;
  score: number; // 0-100
  completionPercentage: number;
}

export interface UserAnalytics {
  userId: string;
  totalLabsStarted: number;
  totalLabsCompleted: number;
  averageTimePerLab: number;
  averageSuccessRate: number;
  totalCommandsAttempted: number;
  totalHintsUsed: number;
  currentStreak: number; // consecutive days of practice
  bestLab?: string;
  weakestArea?: string;
}

export interface LabSession {
  sessionId: string;
  labId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  commandHistory: CommandLog[];
  hintsRevealedCount: number;
  currentProgress: number; // 0-100
}

export interface CommandLog {
  timestamp: Date;
  command: string;
  output: string;
  isCorrect: boolean;
  stepNumber?: number;
}

// Local storage helpers
export const saveLabProgress = (progress: LabProgress) => {
  const key = `lab-progress-${progress.userId}-${progress.labId}`;
  localStorage.setItem(key, JSON.stringify(progress));
};

export const getLabProgress = (userId: string, labId: string): LabProgress | null => {
  const key = `lab-progress-${userId}-${labId}`;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

export const getAllUserProgress = (userId: string): LabProgress[] => {
  const allItems = Object.entries(localStorage);
  return allItems
    .filter(([key]) => key.startsWith(`lab-progress-${userId}-`))
    .map(([, value]) => JSON.parse(value as string));
};

export const calculateUserAnalytics = (userId: string): UserAnalytics => {
  const allProgress = getAllUserProgress(userId);
  
  const completed = allProgress.filter(p => p.isCompleted);
  const totalTime = allProgress.reduce((sum, p) => sum + p.timeSpentMinutes, 0);
  const avgTime = allProgress.length > 0 ? totalTime / allProgress.length : 0;
  
  const totalCommands = allProgress.reduce((sum, p) => sum + p.commandsAttempted, 0);
  const successfulCommands = allProgress.reduce((sum, p) => sum + p.commandsSuccessful, 0);
  const successRate = totalCommands > 0 ? (successfulCommands / totalCommands) * 100 : 0;
  
  const bestLab = completed.length > 0 ? completed.reduce((prev, current) => 
    current.score > prev.score ? current : prev
  ).labId : undefined;
  
  return {
    userId,
    totalLabsStarted: allProgress.length,
    totalLabsCompleted: completed.length,
    averageTimePerLab: Math.round(avgTime),
    averageSuccessRate: Math.round(successRate),
    totalCommandsAttempted: totalCommands,
    totalHintsUsed: allProgress.reduce((sum, p) => sum + p.hintsUsed, 0),
    currentStreak: 0, // Can be enhanced with date tracking
    bestLab,
  };
};

export const startLabSession = (labId: string, userId: string): LabSession => {
  const session: LabSession = {
    sessionId: `session-${labId}-${userId}-${Date.now()}`,
    labId,
    userId,
    startTime: new Date(),
    commandHistory: [],
    hintsRevealedCount: 0,
    currentProgress: 0,
  };
  
  localStorage.setItem(`lab-session-${session.sessionId}`, JSON.stringify(session));
  return session;
};

export const updateSessionProgress = (sessionId: string, progress: Partial<LabSession>) => {
  const key = `lab-session-${sessionId}`;
  const existing = localStorage.getItem(key);
  if (existing) {
    const session = JSON.parse(existing);
    const updated = { ...session, ...progress };
    localStorage.setItem(key, JSON.stringify(updated));
  }
};
