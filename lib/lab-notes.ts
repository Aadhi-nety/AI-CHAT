export interface LabNote {
  id: string;
  labId: string;
  sessionId: string;
  timestamp: number;
  stepNumber?: number;
  content: string;
  tags?: string[];
}

const NOTES_STORAGE_KEY = "aws-labs-notes";

export function saveNote(note: Omit<LabNote, "id" | "timestamp">): LabNote {
  const fullNote: LabNote = {
    ...note,
    id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
  };

  const notes = getAllNotes();
  notes.push(fullNote);
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));

  return fullNote;
}

export function getNotesForLab(labId: string, sessionId?: string): LabNote[] {
  const notes = getAllNotes();
  return notes.filter((note) => {
    const labMatch = note.labId === labId;
    const sessionMatch = sessionId ? note.sessionId === sessionId : true;
    return labMatch && sessionMatch;
  });
}

export function updateNote(
  noteId: string,
  content: string,
  tags?: string[]
): LabNote | null {
  const notes = getAllNotes();
  const noteIndex = notes.findIndex((n) => n.id === noteId);

  if (noteIndex === -1) return null;

  notes[noteIndex].content = content;
  if (tags) {
    notes[noteIndex].tags = tags;
  }

  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  return notes[noteIndex];
}

export function deleteNote(noteId: string): boolean {
  const notes = getAllNotes();
  const filtered = notes.filter((n) => n.id !== noteId);

  if (filtered.length === notes.length) return false;

  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

export function getAllNotes(): LabNote[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(NOTES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Failed to parse notes:", error);
    return [];
  }
}

export function getNotesStats(labId: string): {
  totalNotes: number;
  lastNoteTime: number | null;
  notesByStep: Record<number, number>;
} {
  const notes = getNotesForLab(labId);

  const notesByStep: Record<number, number> = {};
  notes.forEach((note) => {
    if (note.stepNumber !== undefined) {
      notesByStep[note.stepNumber] = (notesByStep[note.stepNumber] || 0) + 1;
    }
  });

  return {
    totalNotes: notes.length,
    lastNoteTime: notes.length > 0 ? Math.max(...notes.map((n) => n.timestamp)) : null,
    notesByStep,
  };
}

export function exportNotesAsMarkdown(labId: string): string {
  const notes = getNotesForLab(labId);

  if (notes.length === 0) {
    return "# No Notes\n\nNo notes found for this lab.";
  }

  let markdown = `# Lab Notes - ${labId}\n\n`;
  markdown += `Generated: ${new Date().toLocaleString()}\n\n`;

  const notesByStep: Record<number, LabNote[]> = {};
  const unorganizedNotes: LabNote[] = [];

  notes.forEach((note) => {
    if (note.stepNumber !== undefined) {
      if (!notesByStep[note.stepNumber]) {
        notesByStep[note.stepNumber] = [];
      }
      notesByStep[note.stepNumber].push(note);
    } else {
      unorganizedNotes.push(note);
    }
  });

  Object.keys(notesByStep)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((step) => {
      markdown += `## Step ${step}\n\n`;
      notesByStep[Number(step)].forEach((note) => {
        markdown += `**${new Date(note.timestamp).toLocaleTimeString()}**\n`;
        markdown += `${note.content}\n\n`;
        if (note.tags?.length) {
          markdown += `Tags: ${note.tags.join(", ")}\n\n`;
        }
      });
    });

  if (unorganizedNotes.length > 0) {
    markdown += `## General Notes\n\n`;
    unorganizedNotes.forEach((note) => {
      markdown += `**${new Date(note.timestamp).toLocaleTimeString()}**\n`;
      markdown += `${note.content}\n\n`;
      if (note.tags?.length) {
        markdown += `Tags: ${note.tags.join(", ")}\n\n`;
      }
    });
  }

  return markdown;
}
