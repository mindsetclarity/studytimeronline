import { read, write } from "./storage";

export interface StudySessionRecord {
  task?: string;
  subject?: string;
  plannerTaskId?: string;
  minutes?: number;
  durationMs?: number;
  mode?: string;
  finishedAt?: string;
  source?: string;
  status?: string;
  notes?: string;
}

export function readSessions(): StudySessionRecord[] {
  const stored = read<StudySessionRecord[]>("studySessions", []);
  return Array.isArray(stored) ? stored : [];
}

export function writeSessions(sessions: StudySessionRecord[]): void {
  write("studySessions", sessions.slice(0, 100)); // Keep last 100
}

export function recordCompletedStudySession(session: StudySessionRecord): void {
  const sessions = readSessions();
  
  // Prevent duplicate completion records for planner tasks
  if (session.plannerTaskId) {
    const alreadyCompleted = sessions.some(s => 
      s.plannerTaskId === session.plannerTaskId && 
      s.status === "completed"
    );
    if (alreadyCompleted) return;
  }

  sessions.unshift({
    ...session,
    finishedAt: session.finishedAt || new Date().toISOString(),
    status: session.status || "completed"
  });

  writeSessions(sessions);
}
