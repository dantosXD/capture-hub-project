'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Square, Loader2, Check, X, Plus, AlertCircle } from 'lucide-react';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import { captureItemMutations } from '@/lib/api-client';
import { toast } from 'sonner';

// Web Speech API type declarations (not in default TS lib)
interface SpeechRecognitionResultItem {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultItem[];
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface WebSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface VoiceCaptureProps {
  onComplete?: () => void;
}

type RecordingState = 'idle' | 'requesting' | 'recording' | 'stopped';

export function VoiceCapture({ onComplete }: VoiceCaptureProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);

  const mutation = useOptimisticMutation({
    mutateFn: async (data: any) => captureItemMutations.create(data),
    errorMessage: 'Failed to save voice capture.',
  });

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecordingState('stopped');
    setInterimTranscript('');
  }, []);

  const startRecording = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    setRecordingState('requesting');

    const recognition: WebSpeechRecognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setRecordingState('recording');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) {
        setTranscript(prev => (prev + final).trimStart());
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[VoiceCapture] Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        toast.error('Microphone access denied. Please allow microphone access and try again.');
      } else if (event.error !== 'aborted') {
        toast.error(`Speech recognition error: ${event.error}`);
      }
      setRecordingState('idle');
      setInterimTranscript('');
    };

    recognition.onend = () => {
      setInterimTranscript('');
      if (recordingState === 'recording') {
        setRecordingState('stopped');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [recordingState]);

  // Auto-populate title from first sentence of transcript
  useEffect(() => {
    if (transcript && !title) {
      const firstSentence = transcript.split(/[.!?]/)[0].trim();
      if (firstSentence.length > 0 && firstSentence.length <= 120) {
        setTitle(firstSentence);
      } else if (firstSentence.length > 120) {
        setTitle(firstSentence.substring(0, 120));
      }
    }
  }, [transcript, title]);

  const handleAddTag = (tagToAdd?: string) => {
    const tag = (tagToAdd || tagInput).trim();
    if (tag && !tags.includes(tag)) {
      setTags(prev => [...prev, tag]);
    }
    if (!tagToAdd) setTagInput('');
  };

  const handleSave = async () => {
    if (!transcript.trim() && !title.trim()) {
      toast.error('Nothing to save. Record some audio first.');
      return;
    }
    const effectiveTitle = title.trim() || transcript.trim().substring(0, 80);
    try {
      await mutation.mutate({
        type: 'note',
        title: effectiveTitle,
        content: transcript.trim() || null,
        tags,
      });
      toast.success(`"${effectiveTitle}" saved!`, { icon: <Check className="w-4 h-4" /> });
      onComplete?.();
    } catch {
      // mutation hook handles error toast
    }
  };

  const handleReset = () => {
    stopRecording();
    setTranscript('');
    setInterimTranscript('');
    setTitle('');
    setTags([]);
    setTagInput('');
    setRecordingState('idle');
  };

  if (!supported) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <AlertCircle className="w-12 h-12 text-amber-500" />
        <div>
          <p className="font-medium">Voice capture not supported</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your browser does not support the Web Speech API. Try Chrome or Edge.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Recording button */}
      <div className="flex flex-col items-center gap-4 py-4">
        {recordingState === 'idle' || recordingState === 'stopped' ? (
          <button
            onClick={startRecording}
            className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
            aria-label="Start recording"
          >
            <Mic className="w-10 h-10" />
          </button>
        ) : recordingState === 'requesting' ? (
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <button
            onClick={stopRecording}
            className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/40 flex items-center justify-center relative"
            aria-label="Stop recording"
          >
            {/* Pulse rings while recording */}
            <span className="absolute inset-0 rounded-full bg-red-400/30 animate-ping" />
            <span className="absolute inset-2 rounded-full bg-red-400/20 animate-ping [animation-delay:0.3s]" />
            <Square className="w-10 h-10 relative z-10" />
          </button>
        )}

        <p className="text-sm text-muted-foreground">
          {recordingState === 'idle' && 'Tap to start recording'}
          {recordingState === 'requesting' && 'Requesting microphone access…'}
          {recordingState === 'recording' && 'Recording — tap to stop'}
          {recordingState === 'stopped' && 'Recording stopped — review below'}
        </p>
      </div>

      {/* Transcript display */}
      {(transcript || interimTranscript) && (
        <div className="p-3 bg-muted rounded-lg text-sm min-h-[80px] max-h-48 overflow-y-auto">
          <span>{transcript}</span>
          {interimTranscript && (
            <span className="text-muted-foreground italic">{interimTranscript}</span>
          )}
        </div>
      )}

      {/* Title field (shown once we have a transcript) */}
      {(transcript || recordingState === 'stopped') && (
        <div className="space-y-3">
          <Input
            placeholder="Title (auto-filled from speech)..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-base font-medium"
          />

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {tags.map(tag => (
                <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                  {tag}
                  <button onClick={() => setTags(t => t.filter(x => x !== tag))}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="Add tags..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); handleAddTag(); }
              }}
              className="flex-1 text-sm"
            />
            <Button size="icon" variant="ghost" onClick={() => handleAddTag()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="default"
              onClick={handleSave}
              disabled={mutation.isPending || (!transcript.trim() && !title.trim())}
              className="flex-1 h-11"
            >
              {mutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</>
              ) : (
                <><Check className="w-4 h-4 mr-2" />Save to Inbox</>
              )}
            </Button>
            <Button variant="ghost" onClick={handleReset} disabled={mutation.isPending}>
              <MicOff className="w-4 h-4 mr-1" /> Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
