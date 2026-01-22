'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  useFirestore,
  useDoc,
  useCollection,
  useMemoFirebase,
  updateDocumentNonBlocking,
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
  useUser,
} from '@/firebase';
import {
  doc,
  collection,
  writeBatch,
  DocumentReference,
  Query,
  getDocs,
  serverTimestamp,
  increment,
  orderBy,
  query,
} from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Trash2,
  PlusCircle,
  Loader2,
  Check,
  X,
  Save,
  Languages,
} from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { languages, Language } from '@/lib/data';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { translateText } from '@/ai/flows/translate-text';

interface Answer {
  id: string;
  text: string;
  isCorrect: boolean;
  ref: DocumentReference;
}

interface Question {
  id: string;
  text: string;
  correctAnswerId?: string;
  ref: DocumentReference;
  answers: Answer[];
}

interface Quiz {
  id: string;
  name: string;
  description: string;
}

export default function QuizClientView({ quizId }: { quizId: string }) {
  const firestore = useFirestore();
  const [userType, setUserType] = useState<'student' | 'teacher' | null>(null);
  const [loading, setLoading] = useState(true);

  const quizRef = useMemoFirebase(
    () =>
      firestore ? doc(firestore, `classSections/IS-B/quizzes/${quizId}`) : null,
    [firestore, quizId]
  );
  const questionsCollection = useMemoFirebase(
    () => (quizRef ? collection(quizRef, 'questions') : null),
    [quizRef]
  );
  const questionsQuery = useMemoFirebase(
    () => (questionsCollection ? query(questionsCollection, orderBy('createdAt', 'asc')) : null),
    [questionsCollection]
  );

  const { data: quiz, isLoading: isQuizLoading } = useDoc<Quiz>(quizRef);
  const { data: questionsData, isLoading: areQuestionsLoading } =
    useCollection<Omit<Question, 'answers' | 'ref'>>(questionsQuery);

  useEffect(() => {
    const type = localStorage.getItem('userType') as
      | 'student'
      | 'teacher'
      | null;
    setUserType(type);
    setLoading(false);
  }, []);

  if (isQuizLoading || areQuestionsLoading || loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!quiz) {
    return <div>Quiz not found.</div>;
  }

  const questions =
    firestore && questionsData
      ? questionsData.map(q => ({
        ...q,
        ref: doc(firestore, `classSections/IS-B/quizzes/${quizId}/questions/${q.id}`),
      }))
      : [];

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      {userType === 'teacher' ? (
        <EditableQuizHeader quiz={quiz} quizRef={quizRef} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold font-headline">
              {quiz.name}
            </CardTitle>
            <CardDescription>{quiz.description}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {userType === 'teacher' ? (
        <TeacherView
          questions={questions || []}
          questionsCollection={questionsCollection}
          quizRef={quizRef}
        />
      ) : (
        <StudentView quizId={quizId} questions={questions} />
      )}
    </div>
  );
}

function EditableQuizHeader({
  quiz,
  quizRef,
}: {
  quiz: Quiz;
  quizRef: DocumentReference | null;
}) {
  const [name, setName] = useState(quiz.name);
  const [description, setDescription] = useState(quiz.description);

  const handleSave = () => {
    if (!quizRef) return;
    if (name !== quiz.name || description !== quiz.description) {
      updateDocumentNonBlocking(quizRef, { name, description });
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div>
          <Label htmlFor="quiz-title" className="text-sm font-medium">
            Quiz Title
          </Label>
          <Input
            id="quiz-title"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleSave}
            disabled={!quizRef}
            className="text-3xl font-bold font-headline h-auto p-0 border-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div>
          <Label htmlFor="quiz-description" className="text-sm font-medium">
            Description
          </Label>
          <Textarea
            id="quiz-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={handleSave}
            disabled={!quizRef}
            className="border-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-muted-foreground"
          />
        </div>
      </CardHeader>
    </Card>
  );
}

// --- Teacher View ---
function TeacherView({
  questions,
  questionsCollection,
  quizRef,
}: {
  questions: (Omit<Question, 'answers'> & { ref: DocumentReference })[];
  questionsCollection: any;
  quizRef: DocumentReference | null;
}) {
  const router = useRouter();

  const handleAddQuestion = () => {
    if (!questionsCollection || !quizRef) return;
    addDocumentNonBlocking(questionsCollection, {
      text: '',
      correctAnswerId: null,
      createdAt: serverTimestamp(),
    });
    updateDocumentNonBlocking(quizRef, { questionCount: increment(1) });
  };

  const handleSaveChanges = () => {
    // Since documents auto-save on blur, we just navigate back or show success.
    router.push('/quizzes');
  };

  return (
    <div className="space-y-6">
      {questions.map(
        (q: Omit<Question, 'answers'> & { ref: DocumentReference }, index: number) => (
          <EditableQuestion
            key={q.id}
            question={q}
            index={index}
            quizRef={quizRef}
          />
        )
      )}
      <div className="flex gap-4 border-t pt-6">
        <Button onClick={handleAddQuestion} variant="outline" disabled={!questionsCollection}>
          <PlusCircle className="mr-2" /> Add Question
        </Button>
        <Button onClick={handleSaveChanges} className="px-8 bg-green-600 hover:bg-green-700 ml-auto">
          <Save className="mr-2 h-4 w-4" /> Save Changes
        </Button>
      </div>
    </div>
  );
}

function EditableQuestion({
  question,
  index,
  quizRef,
}: {
  question: Omit<Question, 'answers'> & { ref: DocumentReference };
  index: number;
  quizRef: DocumentReference | null;
}) {
  const [questionText, setQuestionText] = useState(question.text || '');

  const handleBlur = () => {
    if (question.text !== questionText) {
      updateDocumentNonBlocking(question.ref, { text: questionText });
    }
  };

  const handleQuestionDelete = () => {
    // Also delete sub-collection of answers
    getDocs(collection(question.ref, 'answers')).then(snapshot => {
      snapshot.forEach(doc => {
        deleteDocumentNonBlocking(doc.ref);
      });
    });
    deleteDocumentNonBlocking(question.ref);
    if (quizRef) {
      updateDocumentNonBlocking(quizRef, { questionCount: increment(-1) });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Label htmlFor={`q-${question.id}`} className="text-lg font-semibold">
            Question {index + 1}
          </Label>
          <Input
            id={`q-${question.id}`}
            value={questionText}
            onChange={e => setQuestionText(e.target.value)}
            onBlur={handleBlur}
            className="flex-1"
            placeholder="Type your question here..."
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleQuestionDelete}
            aria-label="Delete question"
          >
            <Trash2 className="h-5 w-5 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <EditableAnswersList question={question} />
      </CardContent>
    </Card>
  );
}

function EditableAnswersList({
  question,
}: {
  question: Omit<Question, 'answers'> & { ref: DocumentReference };
}) {
  const firestore = useFirestore();
  const answersRef = useMemoFirebase(
    () => (firestore ? collection(question.ref, 'answers') : null),
    [firestore, question.ref]
  );
  const { data: answers, isLoading } = useCollection<Omit<Answer, 'ref'>>(answersRef);

  const handleAddAnswer = () => {
    if (answersRef) {
      addDocumentNonBlocking(answersRef, { text: 'New Answer', isCorrect: false });
    }
  };

  if (isLoading) {
    return <Loader2 className="animate-spin" />;
  }

  return (
    <div className="space-y-4 pl-12">
      {(answers || []).map(answer => (
        <EditableAnswer
          key={answer.id}
          answer={{ ...answer, ref: doc(answersRef!.firestore, answersRef!.path, answer.id) }}
          question={question}
          allAnswers={answers || []}
        />
      ))}
      {(answers || []).length < 5 && (
        <Button onClick={handleAddAnswer} variant="ghost" size="sm">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Answer
        </Button>
      )}
    </div>
  );
}

function EditableAnswer({
  answer,
  question,
  allAnswers
}: {
  answer: Answer;
  question: Omit<Question, 'answers'> & { ref: DocumentReference };
  allAnswers: Omit<Answer, 'ref'>[]
}) {
  const firestore = useFirestore();
  const [answerText, setAnswerText] = useState(answer.text || '');

  const handleBlur = () => {
    if (answer.text !== answerText) {
      updateDocumentNonBlocking(answer.ref, { text: answerText });
    }
  };

  const handleSetCorrect = async () => {
    if (!firestore) return;
    const batch = writeBatch(firestore);

    // Set this answer as correct
    batch.update(answer.ref, { isCorrect: true });
    // Set this as the correct answer ID on the question
    batch.update(question.ref, { correctAnswerId: answer.id });

    // Set all other answers for this question to incorrect
    allAnswers.forEach(ans => {
      if (ans.id !== answer.id) {
        const otherAnswerRef = doc(answer.ref.parent, ans.id);
        batch.update(otherAnswerRef, { isCorrect: false });
      }
    });

    await batch.commit();
  };


  return (
    <div className="flex items-center gap-2">
      <Button
        variant={answer.isCorrect ? 'default' : 'outline'}
        size="icon"
        onClick={handleSetCorrect}
        aria-label="Set as correct answer"
      >
        <Check className="h-4 w-4" />
      </Button>
      <Input
        value={answerText}
        onChange={e => setAnswerText(e.target.value)}
        onBlur={handleBlur}
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => deleteDocumentNonBlocking(answer.ref)}
        aria-label="Delete answer"
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}



type TranslatedContent = {
  questionText: string;
  answers: { [answerId: string]: string };
};

function StudentView({
  quizId,
  questions,
}: {
  quizId: string;
  questions: (Omit<Question, 'answers' | 'ref'> & { ref: DocumentReference })[] | null;
}) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('English');
  const firestore = useFirestore();
  const { user } = useUser();
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);

  // Progress Calculation
  const totalQuestions = questions?.length || 0;
  const answeredCount = Object.keys(selectedAnswers).length;
  const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  // Timer Effect
  useEffect(() => {
    if (!submitted) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [submitted, startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }


  const handleAnswerChange = (questionId: string, answerId: string) => {
    setSelectedAnswers(prev => ({ ...prev, [questionId]: answerId }));
  };

  const handleSubmit = async () => {
    if (!questions || !firestore || !user) return;

    let newScore = 0;
    questions.forEach((q: Omit<Question, 'answers' | 'ref'>) => {
      if (selectedAnswers[q.id] === q.correctAnswerId) {
        newScore++;
      }
    });

    const timeTaken = (Date.now() - startTime) / 1000;
    const xpGained = newScore * 10;
    const accuracy = ((newScore / totalQuestions) * 100).toFixed(1);

    setScore(newScore);
    setSubmitted(true);

    // 1. Store in User Profile (for personal history)
    const userResultsRef = collection(firestore, 'users', user.uid, 'studentQuizResults');
    await addDocumentNonBlocking(userResultsRef, {
      userId: user.uid,
      quizId: quizId,
      score: newScore,
      totalQuestions: totalQuestions,
      submissionDateTime: serverTimestamp(),
      timeTaken,
      xpGained,
      answers: selectedAnswers, // Detailed answers for future review
      accuracy
    });

    // 2. Store in Quiz Submissions (for Teacher Analytics)
    // Using setDoc with userID to prevent duplicates if retrying logic isn't blocked elsewhere, 
    // but here we use addDoc to allow multiple attempts.
    const quizSubmissionsRef = collection(firestore, `classSections/IS-B/quizzes/${quizId}/submissions`);
    await addDocumentNonBlocking(quizSubmissionsRef, {
      userId: user.uid,
      userName: user.displayName || "Unknown Student",
      score: newScore,
      totalQuestions: totalQuestions,
      submittedAt: serverTimestamp(),
      xpGained,
      timeTaken
    });

    // 3. Update User XP
    const userProfileRef = doc(firestore, 'users', user.uid);
    updateDocumentNonBlocking(userProfileRef, {
      totalXp: increment(xpGained)
    });
  };

  if (!questions) return <Loader2 className="animate-spin" />;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-10">

      {/* Quiz Header / Stats Bar */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md pb-4 pt-2 border-b space-y-4">
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="language-select" className="text-sm font-medium text-muted-foreground">Language:</Label>
            <Select onValueChange={(value) => setSelectedLanguage(value as Language)} defaultValue={selectedLanguage} disabled={submitted}>
              <SelectTrigger id="language-select" className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map(lang => (
                  <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={`font-mono font-bold text-xl ${submitted ? 'text-green-500' : 'text-primary'}`}>
            {formatTime(elapsedTime)}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-500 ease-out"
            style={{ width: `${submitted ? (score / totalQuestions) * 100 : progress}%`, backgroundColor: submitted ? (score / totalQuestions > 0.5 ? '#22c55e' : '#ef4444') : undefined }}
          />
        </div>
      </div>

      {submitted && (
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20 shadow-lg">
          <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center border-4 border-green-500 shadow-xl mb-2">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-4xl font-extrabold text-green-700">Quiz Completed!</h2>
            <div className="grid grid-cols-3 gap-8 w-full max-w-md pt-4">
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Score</p>
                <p className="text-3xl font-bold">{score} / {totalQuestions}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">XP</p>
                <p className="text-3xl font-bold text-amber-500">+{score * 10}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Accuracy</p>
                <p className="text-3xl font-bold">{((score / totalQuestions) * 100).toFixed(0)}%</p>
              </div>
            </div>
            <Button onClick={() => window.location.reload()} variant="outline" className="mt-6">Try Again</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-8">
        {questions.map((q, index: number) => (
          <QuestionDisplay
            key={q.id}
            question={q}
            index={index}
            selectedAnswer={selectedAnswers[q.id]}
            onAnswerChange={handleAnswerChange}
            submitted={submitted}
            language={selectedLanguage}
          />
        ))}
      </div>

      <CardFooter className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t z-40 flex justify-center md:static md:bg-transparent md:border-0 md:p-0 md:justify-end">
        {!submitted ? (
          <Button
            onClick={handleSubmit}
            size="lg"
            className="w-full md:w-auto shadow-lg hover:shadow-primary/25 transition-all text-lg px-8 rounded-full"
            disabled={!questions || Object.keys(selectedAnswers).length !== questions.length}
          >
            Submit Assessment
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm italic">Results saved to your profile.</p>
        )}
      </CardFooter>
    </div>
  );
}

// Simple in-memory cache for translations during the session
const translationCache: Record<string, TranslatedContent> = {};

function QuestionDisplay({
  question,
  index,
  selectedAnswer,
  onAnswerChange,
  submitted,
  language
}: {
  question: Omit<Question, 'answers' | 'ref'> & { ref: DocumentReference };
  index: number;
  selectedAnswer: string;
  onAnswerChange: (questionId: string, answerId: string) => void;
  submitted: boolean;
  language: Language;
}) {
  const firestore = useFirestore();
  const answersRef = useMemoFirebase(
    () => (firestore ? collection(question.ref, 'answers') : null),
    [firestore, question.ref]
  );
  const { data: answersData, isLoading: areAnswersLoading } =
    useCollection<Omit<Answer, 'ref'>>(answersRef);

  const [translatedContent, setTranslatedContent] = useState<TranslatedContent | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchTranslation = async () => {
      if (!question.text || !answersData) return;

      const cacheKey = `${question.id}-${language}`;

      // 1. Handle English (Original)
      if (language === 'English') {
        const originalAnswers: { [id: string]: string } = {};
        answersData.forEach(a => originalAnswers[a.id] = a.text);
        const originalContent = { questionText: question.text, answers: originalAnswers };

        if (active) {
          setTranslatedContent(originalContent);
          setIsTranslating(false);
        }
        return;
      }

      // 2. Check Cache
      if (translationCache[cacheKey]) {
        if (active) {
          setTranslatedContent(translationCache[cacheKey]);
          setIsTranslating(false);
        }
        return;
      }

      // 3. Perform Translation
      if (active) setIsTranslating(true);

      try {
        const answersToTranslate = answersData.map(a => ({ id: a.id, text: a.text }));

        // Use the original English text for translation source
        const result = await translateText({
          question: question.text,
          answers: answersToTranslate,
          targetLanguage: language,
        });

        const translatedAnswers: { [id: string]: string } = {};
        result.translatedAnswers.forEach(a => {
          translatedAnswers[a.id] = a.text;
        });

        const newContent = {
          questionText: result.translatedQuestion,
          answers: translatedAnswers,
        };

        // Save to cache
        translationCache[cacheKey] = newContent;

        if (active) {
          setTranslatedContent(newContent);
        }
      } catch (e) {
        console.error("Translation failed", e);
        // Fallback to English on error
        const originalAnswers: { [id: string]: string } = {};
        answersData.forEach(a => originalAnswers[a.id] = a.text);
        if (active) {
          setTranslatedContent({ questionText: question.text, answers: originalAnswers });
        }
      } finally {
        if (active) setIsTranslating(false);
      }
    };

    fetchTranslation();

    return () => {
      active = false;
    };
  }, [language, question.text, answersData, question.id]);


  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Question {index + 1}: {isTranslating ? <Loader2 className="inline-block animate-spin h-5 w-5 ml-2" /> : (translatedContent?.questionText || question.text)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {areAnswersLoading || (isTranslating && !translatedContent) ? (
          <div className="flex justify-center p-4">
            <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
          </div>
        ) : (
          <RadioGroup
            value={selectedAnswer}
            onValueChange={value => onAnswerChange(question.id, value)}
            disabled={submitted}
            className="space-y-2"
          >
            {answersData?.map(answer => {
              const isSelected = selectedAnswer === answer.id;
              const isCorrectAnswer = answer.id === question.correctAnswerId;
              const answerText = translatedContent?.answers[answer.id] || answer.text;

              let ringColor = 'ring-transparent';
              if (submitted) {
                if (isCorrectAnswer) {
                  ringColor = 'ring-green-500';
                } else if (isSelected && !isCorrectAnswer) {
                  ringColor = 'ring-red-500';
                }
              }

              return (
                <div
                  key={answer.id}
                  className={`flex items-center space-x-3 rounded-md border p-3 transition-all ring-2 ${ringColor}`}
                >
                  <RadioGroupItem value={answer.id} id={answer.id} />
                  <Label htmlFor={answer.id} className="flex-1 cursor-pointer">
                    {answerText}
                  </Label>
                  {submitted && isSelected && !isCorrectAnswer && (
                    <X className="text-red-600" />
                  )}
                  {submitted && isCorrectAnswer && (
                    <Check className="text-green-600" />
                  )}
                </div>
              );
            })}
          </RadioGroup>
        )}
      </CardContent>
    </Card>
  );
}
