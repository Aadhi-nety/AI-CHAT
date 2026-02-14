'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveNote, getNotesForLab, deleteNote, exportNotesAsMarkdown } from '@/lib/lab-notes';
import { Trash2, Download, Plus } from 'lucide-react';

interface LabNotesPanelProps {
  labId: string;
  sessionId: string;
  stepNumber?: number;
}

export function LabNotesPanel({ labId, sessionId, stepNumber }: LabNotesPanelProps) {
  const [notes, setNotes] = useState<ReturnType<typeof getNotesForLab>>([]);
  const [newNote, setNewNote] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const labNotes = getNotesForLab(labId, sessionId);
    setNotes(labNotes);
  }, [labId, sessionId]);

  const handleAddNote = () => {
    if (newNote.trim()) {
      const note = saveNote({
        labId,
        sessionId,
        stepNumber,
        content: newNote,
        tags: stepNumber ? [`Step ${stepNumber}`] : [],
      });
      setNotes([...notes, note]);
      setNewNote('');
    }
  };

  const handleDeleteNote = (noteId: string) => {
    if (deleteNote(noteId)) {
      setNotes(notes.filter((n) => n.id !== noteId));
    }
  };

  const handleExport = () => {
    const markdown = exportNotesAsMarkdown(labId);
    const element = document.createElement('a');
    element.setAttribute(
      'href',
      'data:text/plain;charset=utf-8,' + encodeURIComponent(markdown)
    );
    element.setAttribute('download', `${labId}-notes.md`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">My Notes ({notes.length})</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-transparent border-border/50 hover:bg-card/60"
        >
          {isOpen ? 'Hide' : 'Show'}
        </Button>
      </div>

      {isOpen && (
        <Card className="border-border/50 bg-card/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add Note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write your notes here..."
                className="w-full h-20 rounded-lg bg-background/50 border border-border/50 text-foreground p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                size="sm"
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
              >
                <Plus className="h-3 w-3 mr-2" />
                Add Note
              </Button>
            </div>

            {notes.length > 0 && (
              <>
                <div className="h-px bg-border/50"></div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-2 rounded-lg bg-background/50 border border-border/50 text-sm space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-muted-foreground text-xs">
                          {new Date(note.timestamp).toLocaleTimeString()}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteNote(note.id)}
                          className="h-5 w-5 p-0 hover:bg-red-600/20 hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-foreground/80">{note.content}</p>
                      {note.tags?.length > 0 && (
                        <div className="flex gap-1 flex-wrap pt-1">
                          {note.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  onClick={handleExport}
                  size="sm"
                  variant="outline"
                  className="w-full bg-transparent border-border/50 hover:bg-card/60"
                >
                  <Download className="h-3 w-3 mr-2" />
                  Export as Markdown
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
