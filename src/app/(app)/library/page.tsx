'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { languages, subjects, Subject, Language } from '@/lib/data';
import {
  useFirestore,
  useUser,
  useCollection,
  useMemoFirebase,
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
  WithId,
  setDocumentNonBlocking,
  useFirebaseApp,
} from '@/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  doc,
  serverTimestamp,
  getDoc,
  addDoc,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  getStorage,
} from 'firebase/storage';
import {
  BiologyIcon,
  ChemistryIcon,
  MathIcon,
  PhysicsIcon,
} from '@/components/common/SubjectIcons';
import {
  File,
  FileText,
  Video,
  PlusCircle,
  Loader2,
  Trash2,
  BookOpen,
  PlayCircle,
  UploadCloud,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from "next-themes";
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { generateTranscript } from '@/ai/flows/generate-transcript';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

const subjectIconMap: Record<Subject, React.ElementType> = {
  Physics: PhysicsIcon,
  Chemistry: ChemistryIcon,
  Biology: BiologyIcon,
  Math: MathIcon,
};

const resourceTypeIconMap: Record<string, React.ElementType> = {
  Video: Video,
  PDF: FileText,
  Notes: File,
};

interface Resource {
  title: string;
  description: string;
  transcript?: string;
  subject: Subject;
  type: 'Video' | 'PDF' | 'Notes';
  fileUrl: string;
  language: Language;
  uploaderId: string;
  createdAt: { seconds: number; nanoseconds: number };
}

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

// Helper to parse "MM:SS" to seconds
const parseTimestamp = (timeStr: string) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return 0;
};

interface DubSegment {
  start: string;
  end: string;
  text: string;
  audioDataUri?: string;
  startTime?: number; // Parsed start in seconds
  endTime?: number;   // Parsed end in seconds
}

function ResourcePlayerDialog({
  resource,
  isOpen,
  onClose,
  dubSegments,
}: {
  resource: WithId<Resource> | null;
  isOpen: boolean;
  onClose: () => void;
  dubSegments?: DubSegment[];
}) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null); // For future YouTube support complexity

  // Pre-process segments to have numeric timestamps
  const processedSegments = useMemo(() => {
    return dubSegments?.map(s => ({
      ...s,
      startTime: parseTimestamp(s.start),
      endTime: parseTimestamp(s.end),
    })).sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
  }, [dubSegments]);

  // Sync Logic
  useEffect(() => {
    if (!processedSegments || !audioRef.current) return;

    // Find current segment
    const currentSegment = processedSegments.find(
      s => currentTime >= (s.startTime || 0) && currentTime < (s.endTime || 0)
    );

    if (currentSegment && currentSegment.audioDataUri) {
      const audioEl = audioRef.current;

      // Check if this specific audio is already active
      // Using a custom attribute to track the exact segment helps avoid relying purely on src string comparison
      if (audioEl.getAttribute('data-segment-id') !== currentSegment.start) {
        // Reset handlers to avoid interference
        audioEl.onloadedmetadata = null;
        audioEl.onended = null;

        // Set up the speed-up logic
        audioEl.onloadedmetadata = () => {
          const audioDuration = audioEl.duration;
          const segmentDuration = (currentSegment.endTime || 0) - (currentSegment.startTime || 0);

          // Default to 1x
          let rate = 1.0;

          // If audio is longer than the slot, speed it up to fit!
          if (audioDuration > segmentDuration) {
            rate = audioDuration / segmentDuration;
            // Cap at 2.5x to keep it somewhat intelligible, though user priority is sync.
            rate = Math.min(rate, 2.5);
          }

          audioEl.playbackRate = rate;
          try {
            // Start playing
            audioEl.play().catch(e => console.error("Audio play failed", e));
          } catch (e) { console.error("Sync error", e); }
        };

        audioEl.src = currentSegment.audioDataUri;
        audioEl.setAttribute('data-segment-id', currentSegment.start);
      }
    } else {
      // No segment active.
      // Do not pause abruptly if strictly following "nearly at the same time", 
      // as the speed-up ensures it ends exactly when the segment ends.
      // However, if we drift or jump, we should ensure we don't play old audio.
      // Only if we are truly outside.
      // We generally leave it alone or pause if we are far?
      // Let's safe-guard: if we are NOT in a segment, and audio is playing, it might be trailing overlap?
      // But with `playbackRate` set precisely, it should have ended.
    }

  }, [currentTime, processedSegments]);


  if (!resource || !isOpen) return null;

  const videoId = getYouTubeId(resource.fileUrl);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl p-0 bg-black/95 border-zinc-800 shadow-2xl overflow-hidden">
        <div className="relative aspect-video w-full group">
          {videoId ? (
            <div className="flex items-center justify-center h-full text-white/50 bg-zinc-900">
              <p>Direct Video Uploads only for Live Sync.</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={resource.fileUrl}
              controls
              autoPlay
              muted={!!dubSegments}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="w-full h-full object-contain bg-black"
            />
          )}

          <audio ref={audioRef} className="hidden" />

          {/* Header Overlay */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <h3 className="text-white font-medium tracking-tight drop-shadow-md">{resource.title}</h3>
          </div>

          {/* Sync Status & Subtitles Overlay */}
          {dubSegments && (
            <div className="absolute bottom-8 left-0 right-0 p-6 flex flex-col items-center text-center pointer-events-none transition-all">
              <div className="bg-black/70 backdrop-blur-md px-4 py-2 rounded-full mb-4 flex items-center gap-2 border border-white/10 shadow-xl">
                <div className="relative h-2.5 w-2.5">
                  <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75"></div>
                  <div className="relative h-2.5 w-2.5 bg-green-500 rounded-full"></div>
                </div>
                <span className="text-green-400 text-xs font-bold tracking-wider uppercase">Real-Time Sync</span>
              </div>

              <div className="max-w-3xl">
                <p className="text-white/95 text-lg md:text-xl font-medium leading-relaxed drop-shadow-lg p-2 rounded bg-black/40 box-decoration-clone">
                  {processedSegments?.find(s => currentTime >= (s.startTime || 0) && currentTime < (s.endTime || 0))?.text || ""}
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateResourceDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useUser();
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [transcript, setTranscript] = useState('');
  const [subject, setSubject] = useState<Subject | ''>('');
  const [language, setLanguage] = useState<Language | ''>('');
  const [file, setFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTranscript('');
    setSubject('');
    setLanguage('');
    setFile(null);
    setIsSubmitting(false);
    setUploadProgress(0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (
      !title ||
      !description ||
      !subject ||
      !language ||
      !file ||
      !user ||
      !firestore
    ) {
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      console.error("Cloudinary env vars missing");
      toast({
        variant: 'destructive',
        title: 'Configuration Error',
        description: 'Cloudinary configuration is missing. Please check env variables.',
      });
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', `resources/${user.uid}`);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100;
        setUploadProgress(progress);
      }
    };

    xhr.onload = async () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        const downloadURL = response.secure_url;

        try {
          const resourcesRef = collection(firestore, 'resources');
          await addDoc(resourcesRef, {
            title,
            description,
            transcript,
            subject,
            language,
            type: 'Video',
            fileUrl: downloadURL,
            uploaderId: user.uid,
            createdAt: serverTimestamp(),
          });

          toast({
            title: 'Upload Complete!',
            description: `"${title}" has been added to the library.`,
          });

          resetForm();
          onClose();
        } catch (error) {
          console.error('Firestore save failed:', error);
          toast({
            variant: 'destructive',
            title: 'Save Failed',
            description: 'Video uploaded but failed to save metadata. Please try again.',
          });
        } finally {
          setIsSubmitting(false);
          setUploadProgress(0);
        }
      } else {
        console.error('Cloudinary upload failed:', xhr.responseText);
        toast({
          variant: 'destructive',
          title: 'Upload Failed',
          description: 'Failed to upload video to Cloudinary. Please try again.',
        });
        setIsSubmitting(false);
        setUploadProgress(0);
      }
    };

    xhr.onerror = () => {
      console.error('Network error during upload');
      toast({
        variant: 'destructive',
        title: 'Network Error',
        description: 'A network error occurred during upload. Please check your connection.',
      });
      setIsSubmitting(false);
      setUploadProgress(0);
    };

    xhr.send(formData);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a Video Resource</DialogTitle>
          <DialogDescription>
            Upload a video and provide details for the learning material.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="space-y-2">
            <Label htmlFor="res-title">Title</Label>
            <Input
              id="res-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Introduction to Thermodynamics"
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="res-desc">Description</Label>
            <Textarea
              id="res-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="A brief summary of the resource."
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="res-transcript">Transcript (Optional)</Label>
            <Textarea
              id="res-transcript"
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Paste the full video transcript here for a more accurate AI summary."
              className="h-24"
              disabled={isSubmitting}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="res-subject">Subject</Label>
              <Select
                onValueChange={value => setSubject(value as Subject)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="res-subject">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(s => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="res-language">Original Language</Label>
              <Select
                onValueChange={value => setLanguage(value as Language)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="res-language">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {languages.map(l => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="res-file">Video File</Label>
            <Input
              id="res-file"
              type="file"
              accept="video/mp4,video/quicktime"
              onChange={handleFileChange}
              disabled={isSubmitting}
            />
          </div>
          {isSubmitting && (
            <div className="space-y-2 pt-2">
              <Label>Upload Progress</Label>
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                {Math.round(uploadProgress)}% complete
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onClose();
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              !title ||
              !description ||
              !subject ||
              !language ||
              !file
            }
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-4 w-4" />
            )}
            {isSubmitting ? 'Uploading...' : 'Upload & Add Resource'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AiTranslationEngine({
  resource,
  onPlayDubbed,
}: {
  resource: WithId<Resource>;
  onPlayDubbed: (segments: DubSegment[]) => void;
}) {
  const firestore = useFirestore();
  const [activeTab, setActiveTab] = useState('transcript');

  // Transcript State
  const [transLang, setTransLang] = useState('');
  const [isTransLoading, setIsTransLoading] = useState(false);
  const [transSegments, setTransSegments] = useState<DubSegment[] | null>(null);

  // Audio State
  const [audioLang, setAudioLang] = useState('');
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioSegments, setAudioSegments] = useState<DubSegment[] | null>(null);

  const [error, setError] = useState<string | null>(null);

  // Clear errors when switching tabs
  useEffect(() => {
    setError(null);
  }, [activeTab]);

  // --- TRANSCRIPT HANDLERS ---
  const handleGenerateTranscript = async () => {
    if (!transLang || !firestore) return;
    setIsTransLoading(true);
    setTransSegments(null);
    setError(null);

    const docRef = doc(
      firestore,
      'resources',
      resource.id,
      'transcripts',
      transLang
    );

    try {
      // Check cache
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().segments) {
        setTransSegments(snap.data().segments);
        setIsTransLoading(false);
        return;
      }

      // Generate
      const result = await generateTranscript({
        fileUrl: resource.fileUrl,
        targetLanguage: transLang,
      });

      // Handle the new structure
      // @ts-ignore
      const segments = result.segments || [];

      if (!segments.length && (result as any).transcript) {
        // Fallback if AI returned plain text for some reason
        setError("AI returned outdated format. Please retry.");
        setIsTransLoading(false);
        return;
      }

      setTransSegments(segments);

      // Save
      await setDocumentNonBlocking(docRef, {
        language: transLang,
        segments, // Save structured data
        createdAt: serverTimestamp(),
      });
    } catch (e: any) {
      console.error('Transcript gen failed:', e);
      setError('Failed to generate transcript. Please try again.');
    } finally {
      setIsTransLoading(false);
    }
  };

  // --- AUDIO HANDLERS ---
  const handleGenerateAudio = async () => {
    if (!audioLang || !firestore) return;
    setIsAudioLoading(true);
    setAudioSegments(null);
    setError(null);

    const dubRef = doc(
      firestore,
      'resources',
      resource.id,
      'dubbings',
      audioLang
    );

    try {
      // Check cache
      const snap = await getDoc(dubRef);
      if (snap.exists() && snap.data().segments) {
        setAudioSegments(snap.data().segments);
        setIsAudioLoading(false);
        return;
      }

      // We need the transcript SOURCE segments
      const transRef = doc(
        firestore,
        'resources',
        resource.id,
        'transcripts',
        audioLang
      );
      const transSnap = await getDoc(transRef);
      let sourceSegments: DubSegment[] = [];

      if (transSnap.exists() && transSnap.data().segments) {
        sourceSegments = transSnap.data().segments;
      } else {
        throw new Error(
          'No timestamped transcript found for this language. Please generate a transcript first.'
        );
      }

      // Generate Audio via API
      const response = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments: sourceSegments, language: audioLang }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate audio');
      }

      const result = await response.json();
      const dubbedSegments = result.segments;

      setAudioSegments(dubbedSegments);

      // Save
      await setDocumentNonBlocking(dubRef, {
        language: audioLang,
        segments: dubbedSegments,
        createdAt: serverTimestamp(),
      });
    } catch (e: any) {
      console.error('Audio gen failed:', e);
      setError(e.message || 'Failed to generate audio.');
    } finally {
      setIsAudioLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          AI Studio Control
        </Label>
        {error && <span className="text-xs text-destructive font-medium bg-destructive/10 px-2 py-0.5 rounded">{error}</span>}
      </div>

      <Tabs
        defaultValue="transcript"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 bg-background/50 p-1 border rounded-lg">
          <TabsTrigger value="transcript" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">Transcript</TabsTrigger>
          <TabsTrigger value="audio" className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">Audio Dub</TabsTrigger>
        </TabsList>

        {/* TRANSCRIPT TAB */}
        <TabsContent value="transcript" className="space-y-4 mt-4 origin-top animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <Select
              value={transLang}
              onValueChange={setTransLang}
              disabled={isTransLoading}
            >
              <SelectTrigger className="flex-1 h-10 bg-background border-input focus:ring-primary/20 transition-all">
                <SelectValue placeholder="Target Language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map(l => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleGenerateTranscript}
              disabled={!transLang || isTransLoading}
              className="h-10 px-6 font-semibold shadow-sm"
            >
              {isTransLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Generate'
              )}
            </Button>
          </div>

          {transSegments && (
            <div className="rounded-lg border bg-zinc-950 p-4 h-56 overflow-y-auto space-y-1 font-mono text-sm relative group">
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Badge variant="outline" className="text-xs text-zinc-500 border-zinc-700 bg-zinc-900">Preview</Badge>
              </div>
              {transSegments.map((s, i) => (
                <div key={i} className="grid grid-cols-[60px_1fr] gap-3 text-zinc-400 border-b border-zinc-900/50 pb-1 mb-1 last:border-0 hover:bg-zinc-900/50 hover:text-zinc-200 transition-colors rounded px-1">
                  <span className="text-zinc-600 text-xs pt-0.5">{s.start}</span>
                  <span className="leading-relaxed">{s.text}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* AUDIO TAB */}
        <TabsContent value="audio" className="space-y-4 mt-4 origin-top animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <Select
              value={audioLang}
              onValueChange={setAudioLang}
              disabled={isAudioLoading}
            >
              <SelectTrigger className="flex-1 h-10 bg-background border-input focus:ring-primary/20 transition-all">
                <SelectValue placeholder="Dub Language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map(l => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleGenerateAudio}
              disabled={!audioLang || isAudioLoading}
              className="h-10 px-6 font-semibold shadow-sm"
            >
              {isAudioLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Generate Dub'
              )}
            </Button>
          </div>

          {audioSegments && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900 p-4 text-center">
                <div className="bg-emerald-100 dark:bg-emerald-900/50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h4 className="text-base font-semibold text-emerald-800 dark:text-emerald-300">Sync Complete</h4>
                <p className="text-sm text-emerald-600 dark:text-emerald-400/80 mb-1">{audioSegments.length} audio segments generated.</p>
              </div>
              <Button
                className="w-full h-12 text-base font-medium shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
                onClick={() => onPlayDubbed(audioSegments)}
              >
                <PlayCircle className="h-5 w-5 mr-2" /> Play Synced Video
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResourceCard({
  resource,
  userType,
  firestore,
  onPlay,
  onPlayDubbed,
}: {
  resource: WithId<Resource>;
  userType: string | null;
  firestore: any;
  onPlay: (resource: WithId<Resource>) => void;
  onPlayDubbed: (resource: WithId<Resource>, segments: DubSegment[]) => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [showAiStudio, setShowAiStudio] = useState(false);

  const SubjectIcon = subjectIconMap[resource.subject];
  const TypeIcon = resourceTypeIconMap[resource.type] || BookOpen;

  const videoId = getYouTubeId(resource.fileUrl);
  const thumbnailUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : null;

  const handleDelete = async () => {
    if (!firestore) return;
    setIsDeleting(true);
    try {
      const resourceRef = doc(firestore, 'resources', resource.id);
      await deleteDocumentNonBlocking(resourceRef);
    } catch (error) {
      console.error('Failed to delete resource:', error);
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleCardClick = () => {
    if (resource.type === 'Video') {
      onPlay(resource);
      return;
    }
    window.open(resource.fileUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <div
        className={`group relative flex flex-col bg-card rounded-xl border border-border/50 hover:border-primary/50 shadow-sm hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 overflow-hidden ${showAiStudio ? 'ring-2 ring-primary/20' : ''}`}
      >
        {/* Thumbnail Section */}
        <div
          onClick={handleCardClick}
          className="relative aspect-video w-full overflow-hidden cursor-pointer"
        >
          {thumbnailUrl ? (
            <>
              <Image
                src={thumbnailUrl}
                alt={resource.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="bg-white/90 backdrop-blur rounded-full p-3 shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                  <PlayCircle className="h-8 w-8 text-primary" />
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 group-hover:from-indigo-500/20 group-hover:via-purple-500/20 group-hover:to-pink-500/20 transition-all">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                <TypeIcon className="relative h-12 w-12 text-primary/60 group-hover:text-primary transition-colors" />
              </div>
            </div>
          )}

          <div className="absolute top-3 right-3 flex gap-2">
            <Badge variant="secondary" className="backdrop-blur-md bg-white/90 shadow-sm gap-1">
              <SubjectIcon className="h-3 w-3" />
              {resource.subject}
            </Badge>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-5 flex flex-col flex-grow relative z-10 bg-card">
          <div className="flex justify-between items-start mb-2">
            <div className="space-y-1">
              <h3
                onClick={handleCardClick}
                className="font-semibold text-lg leading-tight cursor-pointer hover:text-primary transition-colors line-clamp-1"
              >
                {resource.title}
              </h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TypeIcon className="h-3 w-3" />
                {resource.type} • English
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 mb-4 min-h-[2.5rem]">
            {resource.description}
          </p>

          <div className="mt-auto flex items-center justify-between pt-2 border-t border-border/50">
            <Button
              variant={showAiStudio ? "default" : "outline"}
              size="sm"
              className={`gap-2 transition-all ${showAiStudio ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-primary/5'}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowAiStudio(!showAiStudio);
              }}
            >
              <Sparkles className={`h-3.5 w-3.5 ${showAiStudio ? 'animate-pulse' : ''}`} />
              {showAiStudio ? 'Close Studio' : 'AI Studio'}
            </Button>

            {userType === 'teacher' && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDeleteDialogOpen(true);
                }}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* AI Studio Panel */}
        <div className={`
             overflow-hidden transition-all duration-300 ease-in-out bg-muted/30 border-t
             ${showAiStudio ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}
        `}>
          <div className="p-4 pt-2">
            <AiTranslationEngine
              resource={resource}
              onPlayDubbed={segments => onPlayDubbed(resource, segments)}
            />
          </div>
        </div>
      </div>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resource?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{resource.title}" and all associated AI generated content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function LibraryPage() {
  const { setTheme, theme } = useTheme();
  const firestore = useFirestore();
  const [userType, setUserType] = useState<'student' | 'teacher' | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<Subject | 'all'>('all');
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<WithId<Resource> | null>(null);
  const [playingDubSegments, setPlayingDubSegments] = useState<DubSegment[] | undefined>(undefined);

  useEffect(() => {
    const type = localStorage.getItem('userType') as 'student' | 'teacher' | null;
    setUserType(type);
  }, []);

  const resourcesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const resourcesCollection = collection(firestore, 'resources');
    // We fetch ALL if searching, or filter by subject. Client-side filtering for search is easiest for small sets.
    // If strict on subject:
    const baseQuery =
      selectedSubject !== 'all'
        ? query(resourcesCollection, where('subject', '==', selectedSubject))
        : query(resourcesCollection);

    return selectedSubject === 'all'
      ? query(baseQuery, orderBy('createdAt', 'desc'))
      : baseQuery;
  }, [firestore, selectedSubject]);

  const { data: rawResources, isLoading } =
    useCollection<Resource>(resourcesQuery);

  const resources = useMemo(() => {
    if (!rawResources) return null;
    let filtered = [...rawResources];

    // Filter by Search Query
    if (searchQuery.trim()) {
      const lowerQ = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.title.toLowerCase().includes(lowerQ) ||
        r.description.toLowerCase().includes(lowerQ) ||
        r.subject.toLowerCase().includes(lowerQ)
      );
    }

    if (selectedSubject !== 'all' && filtered.length > 0) {
      return filtered.sort(
        (a, b) => b.createdAt.seconds - a.createdAt.seconds
      );
    }
    return filtered;
  }, [rawResources, selectedSubject, searchQuery]);

  const handlePlay = (resource: WithId<Resource>) => {
    setSelectedResource(resource);
    setPlayingDubSegments(undefined);
    setIsPlayerOpen(true);
  };

  const handlePlayDubbed = (resource: WithId<Resource>, segments: DubSegment[]) => {
    setSelectedResource(resource);
    setPlayingDubSegments(segments);
    setIsPlayerOpen(true);
  };

  const handleClosePlayer = () => {
    setIsPlayerOpen(false);
    setSelectedResource(null);
    setPlayingDubSegments(undefined);
  };

  return (
    <div className="flex-1 min-h-screen bg-transparent space-y-8 p-6 md:p-10 pb-20">
      {/* Header & Hero */}
      <div className="relative">
        <div className="absolute -top-10 -left-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl opacity-50 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <h2 className="text-4xl font-extrabold tracking-tight font-headline bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
              Content Library
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Immersive STEM learning resources curated for your success.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full bg-background/50 backdrop-blur-sm border-primary/20 hover:bg-primary/10"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-orange-500" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-primary" />
              <span className="sr-only">Toggle theme</span>
            </Button>
            {userType === 'teacher' && (
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="shadow-lg hover:shadow-primary/20 transition-all rounded-full px-6 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Resource
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="sticky top-0 z-20 -mx-6 px-6 py-4 bg-background/80 backdrop-blur-lg border-b border-border/40 flex flex-nowrap items-center gap-4 overflow-x-auto no-scrollbar mask-gradient">
        <div className="flex items-center gap-2 p-1 bg-muted/40 rounded-full border">
          <Button
            variant={selectedSubject === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedSubject('all')}
            className="rounded-full px-4 h-8"
          >
            All
          </Button>
          {subjects.map(s => (
            <Button
              key={s}
              variant={selectedSubject === s ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedSubject(s)}
              className="rounded-full px-4 h-8"
            >
              {s}
            </Button>
          ))}
        </div>

        <div className="h-6 w-[1px] bg-border/50 mx-2" />

        <div className="flex items-center gap-2 flex-grow">
          <div className="relative flex-grow max-w-md hidden md:block">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search topics..."
              className="pl-9 h-9 rounded-full bg-background border-muted hover:border-primary/50 transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Resources Grid */}
      <div className="min-h-[400px]">
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-20 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse">Loading library...</p>
          </div>
        )}

        {!isLoading && resources?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 border-2 border-dashed border-muted rounded-2xl bg-muted/10 mx-auto max-w-2xl">
            <div className="p-4 bg-background rounded-full shadow-sm">
              <BookOpen className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">No Resources Found</h3>
              <p className="text-muted-foreground">
                {userType === 'teacher' ? 'Get started by adding your first resource.' : 'Check back later for new content.'}
              </p>
            </div>
          </div>
        )}

        {!isLoading && resources && resources.length > 0 && (
          <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-12">
            {resources.map(resource => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                userType={userType}
                firestore={firestore}
                onPlay={handlePlay}
                onPlayDubbed={handlePlayDubbed}
              />
            ))}
          </div>
        )}
      </div>

      {userType === 'teacher' && (
        <CreateResourceDialog
          isOpen={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
        />
      )}

      <ResourcePlayerDialog
        resource={selectedResource}
        isOpen={isPlayerOpen}
        onClose={handleClosePlayer}
        dubSegments={playingDubSegments}
      />
    </div>
  );
}

// Simple Helper Icon for Search
function SearchIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}
