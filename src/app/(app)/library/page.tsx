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
} from 'lucide-react';
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
import { generateDubbing } from '@/ai/flows/generate-dubbing';
import { generateTranscript } from '@/ai/flows/generate-transcript';
import { generateAudio } from '@/ai/flows/generate-audio';
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

function ResourcePlayerDialog({
  resource,
  isOpen,
  onClose,
  dubAudioUri,
}: {
  resource: WithId<Resource> | null;
  isOpen: boolean;
  onClose: () => void;
  dubAudioUri?: string;
}) {
  if (!resource || !isOpen) return null;

  const videoId = getYouTubeId(resource.fileUrl);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-auto p-0">
        <DialogHeader className="p-4">
          <DialogTitle>{resource.title}</DialogTitle>
        </DialogHeader>
        <div className="aspect-video relative group">
          {videoId ? (
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1${dubAudioUri ? '&mute=1' : ''
                }`}
              title={resource.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="rounded-b-lg"
            ></iframe>
          ) : (
            <video
              src={resource.fileUrl}
              controls={!dubAudioUri}
              autoPlay
              muted={!!dubAudioUri}
              className="w-full h-full rounded-b-lg bg-black"
            />
          )}
          {dubAudioUri && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-black/60 backdrop-blur-sm rounded-b-lg">
              <p className="text-white text-xs mb-2 font-medium">
                Playing AI Dubbed Audio
              </p>
              <audio
                src={dubAudioUri}
                controls
                autoPlay
                className="w-full h-8"
              />
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
  onPlayDubbed: (audioUri: string) => void;
}) {
  const firestore = useFirestore();
  const [activeTab, setActiveTab] = useState('transcript');

  // Transcript State
  const [transLang, setTransLang] = useState('');
  const [isTransLoading, setIsTransLoading] = useState(false);
  const [transResult, setTransResult] = useState<string | null>(null);

  // Audio State
  const [audioLang, setAudioLang] = useState('');
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioResultUri, setAudioResultUri] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  // Clear errors when switching tabs
  useEffect(() => {
    setError(null);
  }, [activeTab]);

  // --- TRANSCRIPT HANDLERS ---
  const handleGenerateTranscript = async () => {
    if (!transLang || !firestore) return;
    setIsTransLoading(true);
    setTransResult(null);
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
      if (snap.exists()) {
        setTransResult(snap.data().transcript);
        setIsTransLoading(false);
        return;
      }

      // Generate
      const { transcript } = await generateTranscript({
        fileUrl: resource.fileUrl,
        targetLanguage: transLang,
      });

      setTransResult(transcript);

      // Save
      await setDocumentNonBlocking(docRef, {
        language: transLang,
        transcript,
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
    setAudioResultUri(null);
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
      if (snap.exists()) {
        setAudioResultUri(snap.data().audioDataUri);
        setIsAudioLoading(false);
        return;
      }

      // We need the text source.
      // 1. Try to find an existing transcript for this language
      const transRef = doc(
        firestore,
        'resources',
        resource.id,
        'transcripts',
        audioLang
      );
      const transSnap = await getDoc(transRef);
      let textToSpeak = '';

      if (transSnap.exists()) {
        textToSpeak = transSnap.data().transcript;
      } else {
        // Fallback: If no transcript exists, should we generate one?
        // For now, let's error and tell user to generate transcript first.
        throw new Error(
          'No transcript found for this language. Please generate a transcript first.'
        );
      }

      // Generate Audio
      const { audioDataUri } = await generateAudio({
        text: textToSpeak,
        language: audioLang
      });

      setAudioResultUri(audioDataUri);

      // Save
      await setDocumentNonBlocking(dubRef, {
        language: audioLang,
        audioDataUri,
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
    <div className="mt-4 pt-4 border-t border-dashed">
      <Label className="text-xs font-semibold text-muted-foreground mb-2 block">
        AI Content Engine
      </Label>

      <Tabs
        defaultValue="transcript"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transcript">Generate Transcript</TabsTrigger>
          <TabsTrigger value="audio">Generate Audio</TabsTrigger>
        </TabsList>

        {/* TRANSCRIPT TAB */}
        <TabsContent value="transcript" className="space-y-3 mt-3">
          <div className="flex items-center gap-2">
            <Select
              value={transLang}
              onValueChange={setTransLang}
              disabled={isTransLoading}
            >
              <SelectTrigger className="flex-1 h-9">
                <SelectValue placeholder="Select Language" />
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
            >
              {isTransLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Generate'
              )}
            </Button>
          </div>

          {transResult && (
            <div className="rounded-md border p-3 bg-muted/50 text-sm h-32 overflow-y-auto whitespace-pre-wrap">
              {transResult}
            </div>
          )}
        </TabsContent>

        {/* AUDIO TAB */}
        <TabsContent value="audio" className="space-y-3 mt-3">
          <div className="flex items-center gap-2">
            <Select
              value={audioLang}
              onValueChange={setAudioLang}
              disabled={isAudioLoading}
            >
              <SelectTrigger className="flex-1 h-9">
                <SelectValue placeholder="Select Language" />
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
            >
              {isAudioLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Generate'
              )}
            </Button>
          </div>

          {audioResultUri && (
            <Button
              className="w-full gap-2"
              variant="secondary"
              onClick={() => onPlayDubbed(audioResultUri)}
            >
              <PlayCircle className="h-4 w-4" /> Play Dubbed Video
            </Button>
          )}
        </TabsContent>
      </Tabs>

      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
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
  onPlayDubbed: (resource: WithId<Resource>, audioUri: string) => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
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
      <Card className="group flex flex-col overflow-hidden hover:shadow-xl transition-shadow duration-300">
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
                className="object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <PlayCircle className="h-12 w-12 text-white" />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full bg-secondary">
              <TypeIcon className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </div>

        <CardHeader className="p-4 pb-0">
          <div className="flex items-start justify-between gap-2">
            <CardTitle
              onClick={handleCardClick}
              className="text-lg font-headline leading-tight cursor-pointer hover:underline"
            >
              {resource.title}
            </CardTitle>
            <SubjectIcon className="h-7 w-7 text-primary flex-shrink-0 mt-1" />
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2 flex-grow flex flex-col">
          <CardDescription
            onClick={handleCardClick}
            className="text-sm cursor-pointer flex-grow"
          >
            {resource.description}
          </CardDescription>
          <div onClick={e => e.stopPropagation()}>
            <AiTranslationEngine
              resource={resource}
              onPlayDubbed={uri => onPlayDubbed(resource, uri)}
            />
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 pl-1.5">
              <TypeIcon className="h-3.5 w-3.5" /> {resource.type}
            </Badge>
            <Badge variant="outline">{resource.subject}</Badge>
          </div>
          {userType === 'teacher' && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={e => {
                e.stopPropagation();
                setIsDeleteDialogOpen(true);
              }}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the resource "{resource.title}". This
              action cannot be undone.
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
  const firestore = useFirestore();
  const [userType, setUserType] = useState<'student' | 'teacher' | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | 'all'>(
    'all'
  );
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [selectedResource, setSelectedResource] =
    useState<WithId<Resource> | null>(null);
  const [playingDubUri, setPlayingDubUri] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    const type = localStorage.getItem('userType') as
      | 'student'
      | 'teacher'
      | null;
    setUserType(type);
  }, []);

  const resourcesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const resourcesCollection = collection(firestore, 'resources');
    const baseQuery =
      selectedSubject !== 'all'
        ? query(resourcesCollection, where('subject', '==', selectedSubject))
        : query(resourcesCollection);

    // Don't add orderBy if filtering, to avoid needing a composite index
    return selectedSubject === 'all'
      ? query(baseQuery, orderBy('createdAt', 'desc'))
      : baseQuery;
  }, [firestore, selectedSubject]);

  const { data: rawResources, isLoading } =
    useCollection<Resource>(resourcesQuery);

  const resources = useMemo(() => {
    if (!rawResources) return null;
    // If we filtered, sort manually on the client
    if (selectedSubject !== 'all' && rawResources.length > 0) {
      return [...rawResources].sort(
        (a, b) => b.createdAt.seconds - a.createdAt.seconds
      );
    }
    return rawResources;
  }, [rawResources, selectedSubject]);

  const handlePlay = (resource: WithId<Resource>) => {
    setSelectedResource(resource);
    setPlayingDubUri(undefined);
    setIsPlayerOpen(true);
  };

  const handlePlayDubbed = (resource: WithId<Resource>, audioUri: string) => {
    setSelectedResource(resource);
    setPlayingDubUri(audioUri);
    setIsPlayerOpen(true);
  };

  const handleClosePlayer = () => {
    setIsPlayerOpen(false);
    setSelectedResource(null);
    setPlayingDubUri(undefined);
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">
            Content Library
          </h2>
          <p className="text-muted-foreground">
            Explore curated STEM resources uploaded by your teachers.
          </p>
        </div>
        {userType === 'teacher' && (
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Resource
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Input placeholder="Search resources..." disabled />
        <Select
          onValueChange={val => setSelectedSubject(val as Subject | 'all')}
          defaultValue="all"
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjects.map(subject => (
              <SelectItem key={subject} value={subject}>
                {subject}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder="Filter by Language" />
          </SelectTrigger>
          <SelectContent>
            {languages.map(lang => (
              <SelectItem key={lang} value={lang}>
                {lang}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder="Filter by Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Video">Video</SelectItem>
            <SelectItem value="PDF">PDF</SelectItem>
            <SelectItem value="Notes">Notes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      {!isLoading && resources?.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-xl font-semibold">No Resources Found</h3>
          <p className="mt-1 text-sm">
            {userType === 'teacher'
              ? 'Get started by adding a new resource.'
              : 'Your teachers have not added any resources yet.'}
          </p>
        </div>
      )}

      {!isLoading && resources && resources.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
        dubAudioUri={playingDubUri}
      />
    </div>
  );
}
