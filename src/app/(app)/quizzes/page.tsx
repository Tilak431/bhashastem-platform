
'use client';
import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  BiologyIcon,
  ChemistryIcon,
  MathIcon,
  PhysicsIcon,
} from '@/components/common/SubjectIcons';
import type { Subject } from '@/lib/data';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase';
import { collection, query, getDocs, writeBatch, doc } from 'firebase/firestore';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { subjects } from '@/lib/data';
import { PlusCircle, Loader2, Trash2 } from 'lucide-react';

const subjectIconMap: Record<Subject, React.ElementType> = {
  Physics: PhysicsIcon,
  Chemistry: ChemistryIcon,
  Biology: BiologyIcon,
  Math: MathIcon,
};

interface Quiz {
  id: string;
  name: string;
  description: string;
  subject: Subject;
  questionCount: number;
}

function CreateQuizDialog({
  isOpen,
  onClose,
  quizzesRef,
}: {
  isOpen: boolean;
  onClose: () => void;
  quizzesRef: any;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState<Subject | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name || !description || !subject || !quizzesRef) return;
    setIsSubmitting(true);
    try {
      await addDocumentNonBlocking(quizzesRef, {
        name,
        description,
        subject,
        questionCount: 0,
      });
      // Reset form and close
      setName('');
      setDescription('');
      setSubject('');
      onClose();
    } catch (error) {
      console.error('Failed to create quiz:', error);
      // Optionally, show an error toast to the user
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a New Quiz</DialogTitle>
          <DialogDescription>
            Fill out the details below to create a new assessment for your
            class.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="quiz-name">Quiz Name</Label>
            <Input
              id="quiz-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Introduction to Kinematics"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quiz-description">Description</Label>
            <Textarea
              id="quiz-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="A brief summary of what this quiz covers."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quiz-subject">Subject</Label>
            <Select onValueChange={value => setSubject(value as Subject)}>
              <SelectTrigger id="quiz-subject">
                <SelectValue placeholder="Select a subject" />
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !name || !description || !subject}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Quiz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function QuizzesPage() {
  const firestore = useFirestore();
  const [userType, setUserType] = useState<'student' | 'teacher' | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const type = localStorage.getItem('userType') as
      | 'student'
      | 'teacher'
      | null;
    setUserType(type);
  }, []);

  const quizzesQuery = useMemoFirebase(
    () =>
      firestore
        ? query(collection(firestore, 'classSections/IS-B/quizzes'))
        : null,
    [firestore]
  );
  const { data: quizzes, isLoading } = useCollection<Quiz>(quizzesQuery);

  const openDeleteDialog = (quiz: Quiz) => {
    setQuizToDelete(quiz);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteQuiz = async () => {
    if (!quizToDelete || !firestore) return;

    setIsDeleting(true);
    try {
      const quizRef = doc(
        firestore,
        'classSections/IS-B/quizzes',
        quizToDelete.id
      );

      // Batch delete subcollections
      const batch = writeBatch(firestore);
      const questionsRef = collection(quizRef, 'questions');
      const questionsSnapshot = await getDocs(questionsRef);

      for (const questionDoc of questionsSnapshot.docs) {
        const answersRef = collection(questionDoc.ref, 'answers');
        const answersSnapshot = await getDocs(answersRef);
        answersSnapshot.forEach(answerDoc => {
          batch.delete(answerDoc.ref);
        });
        batch.delete(questionDoc.ref);
      }

      // Finally, delete the quiz itself
      batch.delete(quizRef);

      await batch.commit();
    } catch (error) {
      console.error('Failed to delete quiz:', error);
      // Optionally show an error toast
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setQuizToDelete(null);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">
            Assessments
          </h2>
          <p className="text-muted-foreground">
            Test your knowledge and find where you can improve.
          </p>
        </div>
        {userType === 'teacher' && (
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Create Quiz
          </Button>
        )}
      </div>

      {isLoading && <p>Loading quizzes...</p>}

      {!isLoading && quizzes?.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          <h3 className="text-xl font-semibold">No Quizzes Found</h3>
          <p>
            {userType === 'teacher'
              ? 'Get started by creating a new quiz.'
              : 'There are no quizzes available at the moment.'}
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {quizzes?.filter(q => userType === 'teacher' || (q.questionCount && q.questionCount > 0)).map(quiz => {
          const Icon = subjectIconMap[quiz.subject];
          return (
            <Card
              key={quiz.id}
              className="flex flex-col hover:shadow-lg transition-shadow duration-300"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-headline">
                    {quiz.name}
                  </CardTitle>
                  {Icon && <Icon className="h-7 w-7 text-primary" />}
                </div>
                <CardDescription>
                  A {quiz.subject} quiz with {quiz.questionCount || 0}{' '}
                  questions.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">
                  {quiz.description}
                </p>
              </CardContent>
              <CardFooter className="gap-2">
                <Button asChild className="w-full">
                  <Link href={`/quizzes/${quiz.id}`}>
                    {userType === 'teacher' ? 'Edit Quiz' : 'Start Quiz'}
                  </Link>
                </Button>
                {userType === 'teacher' && (
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => openDeleteDialog(quiz)}
                    aria-label="Delete quiz"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
      {userType === 'teacher' && (
        <>
          <CreateQuizDialog
            isOpen={isCreateDialogOpen}
            onClose={() => setIsCreateDialogOpen(false)}
            quizzesRef={
              firestore
                ? collection(firestore, 'classSections/IS-B/quizzes')
                : null
            }
          />
          <AlertDialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the
                  quiz "{quizToDelete?.name}" and all of its associated
                  questions and answers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteQuiz}
                  disabled={isDeleting}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {isDeleting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Yes, delete quiz
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
