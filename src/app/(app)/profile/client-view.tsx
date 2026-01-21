
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Medal, Rocket, ShieldCheck, Target, Award, Star, Edit, Check, Settings, UserPlus, UserCheck } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import {
  useUser,
  useCollection,
  useFirestore,
  useMemoFirebase,
  useDoc,
  updateDocumentNonBlocking,
} from '@/firebase';
import { collection, query, orderBy, doc, DocumentReference, writeBatch, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

const mockAchievements = [
  { id: 'a1', name: 'First Quiz', description: 'Completed your first quiz.', Icon: Rocket, unlocked: true },
  { id: 'a2', name: 'Physics Novice', description: 'Completed 3 Physics quizzes.', Icon: Medal, unlocked: true },
  { id: 'a3', name: 'Perfect Score', description: 'Got a 100% on any quiz.', Icon: Target, unlocked: true },
  { id: 'a4', name: 'Chemistry Whiz', description: 'Score above 90% in a Chemistry quiz.', Icon: ShieldCheck, unlocked: true},
  { id: 'a5', name: 'Biology Buff', description: 'Complete all Biology quizzes.', Icon: Medal, unlocked: false },
  { id: 'a6', name: 'Math Magician', description: 'Get a perfect score in Math.', Icon: Target, unlocked: false },
];

interface StudentQuizResult {
  id: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  submissionDateTime: { seconds: number; nanoseconds: number };
  timeTaken: number;
  xpGained: number;
}

interface UserProfile {
    name: string;
    totalXp: number;
    bio: string;
}

interface Follow {
    userId: string;
    followedAt: any;
}


const XP_PER_LEVEL = 100;

function calculateLevel(totalXp: number) {
    if (totalXp < 0) totalXp = 0;
    const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
    const xpForCurrentLevel = (level - 1) * XP_PER_LEVEL;
    const xpForNextLevel = level * XP_PER_LEVEL;
    const xpProgress = totalXp - xpForCurrentLevel;
    const xpToNextLevel = xpForNextLevel - totalXp;
    const progressPercentage = (xpProgress / XP_PER_LEVEL) * 100;
    
    return { level, xpProgress, xpToNextLevel, progressPercentage, xpForNextLevel };
}


function QuizHistoryRow({ result }: { result: StudentQuizResult }) {
  const firestore = useFirestore();
  const [quizName, setQuizName] = useState<string | null>(null);

  const quizRef = useMemoFirebase(
    () => firestore ? doc(firestore, 'classSections/IS-B/quizzes', result.quizId) : null,
    [firestore, result.quizId]
  );
  const { data: quiz } = useDoc(quizRef);

  useEffect(() => {
    if (quiz) {
      setQuizName(quiz.name);
    }
  }, [quiz]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <TableRow>
      <TableCell className="font-medium truncate max-w-[150px]">{quizName || 'Loading...'}</TableCell>
       <TableCell><Badge variant="outline">{result.xpGained} XP</Badge></TableCell>
      <TableCell><Badge variant="outline">{result.score} / {result.totalQuestions}</Badge></TableCell>
      <TableCell className="text-center text-muted-foreground">{formatTime(result.timeTaken)}</TableCell>
      <TableCell className="text-right text-muted-foreground">{format(new Date(result.submissionDateTime.seconds * 1000), 'yyyy-MM-dd')}</TableCell>
    </TableRow>
  );
}


export default function ProfileClientView({ userId: profileUserIdProp }: { userId: string | null }) {
  const { user: currentUser, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  const profileUserId = useMemo(() => {
    // Only return a definitive user ID when it's available, preventing renders with null/undefined.
    if (profileUserIdProp) return profileUserIdProp;
    if (currentUser) return currentUser.uid;
    return null;
  }, [profileUserIdProp, currentUser]);


  const isOwnProfile = useMemo(() => {
    if (!profileUserId || !currentUser) return false;
    return profileUserId === currentUser.uid;
  }, [profileUserId, currentUser]);

  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState('');

  const userProfileRef = useMemoFirebase(
    () => (firestore && profileUserId ? doc(firestore, 'users', profileUserId) as DocumentReference<UserProfile> : null),
    [firestore, profileUserId]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const followersRef = useMemoFirebase(() => (firestore && profileUserId) ? collection(firestore, 'users', profileUserId, 'followers') : null, [firestore, profileUserId]);
  const followingRef = useMemoFirebase(() => (firestore && profileUserId) ? collection(firestore, 'users', profileUserId, 'following') : null, [firestore, profileUserId]);
  
  const { data: followers, isLoading: areFollowersLoading } = useCollection<Follow>(followersRef);
  const { data: following, isLoading: areFollowingLoading } = useCollection<Follow>(followingRef);

  const currentUserFollowingRef = useMemoFirebase(() => (firestore && currentUser?.uid && profileUserId) ? doc(firestore, 'users', currentUser.uid, 'following', profileUserId) : null, [firestore, currentUser?.uid, profileUserId]);
  const { data: isFollowingData, isLoading: isFollowingLoading } = useDoc(currentUserFollowingRef);
  const isFollowing = !!isFollowingData;


  const resultsQuery = useMemoFirebase(() => {
    if (!firestore || !profileUserId) return null;
    return query(collection(firestore, 'users', profileUserId, 'studentQuizResults'), orderBy('submissionDateTime', 'desc'));
  }, [firestore, profileUserId]);

  const { data: quizHistory, isLoading: isHistoryLoading } = useCollection<StudentQuizResult>(resultsQuery);
  
  useEffect(() => {
    if (userProfile?.bio) {
        setBioText(userProfile.bio);
    }
  }, [userProfile?.bio])

  const handleSaveBio = () => {
    if (isOwnProfile && userProfileRef) {
        updateDocumentNonBlocking(userProfileRef, { bio: bioText });
        setIsEditingBio(false);
    }
  }

  const handleFollow = async () => {
    if (!currentUser || !profileUserId || !firestore || isOwnProfile) return;

    const batch = writeBatch(firestore);
    
    const followingDocRef = doc(firestore, 'users', currentUser.uid, 'following', profileUserId);
    batch.set(followingDocRef, { userId: profileUserId, followedAt: serverTimestamp() });
    
    const followerDocRef = doc(firestore, 'users', profileUserId, 'followers', currentUser.uid);
    batch.set(followerDocRef, { userId: currentUser.uid, followedAt: serverTimestamp() });

    await batch.commit();
  };

  const handleUnfollow = async () => {
      if (!currentUser || !profileUserId || !firestore || isOwnProfile) return;

      const batch = writeBatch(firestore);

      const followingDocRef = doc(firestore, 'users', currentUser.uid, 'following', profileUserId);
      batch.delete(followingDocRef);

      const followerDocRef = doc(firestore, 'users', profileUserId, 'followers', currentUser.uid);
      batch.delete(followerDocRef);
      
      await batch.commit();
  };
  
  const isLoading = isAuthLoading || !profileUserId || isProfileLoading || areFollowersLoading || areFollowingLoading || isHistoryLoading;

  if (isLoading) {
      return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (!userProfile) {
    return <div className="flex h-full w-full items-center justify-center">User profile not found.</div>;
  }
  
  const totalQuizzes = quizHistory?.length || 0;
  const totalXp = userProfile?.totalXp || 0;
  const { level, xpToNextLevel, progressPercentage, xpForNextLevel } = calculateLevel(totalXp);


  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
        <Card className="overflow-hidden">
            <CardHeader className="p-0"><div className="bg-gradient-to-r from-primary to-accent h-2" /></CardHeader>
            <CardContent className="p-6">
                <div className="flex items-center gap-6">
                    <div className="relative">
                        <div className="absolute -top-2 -left-2 bg-background rounded-full p-1">
                            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 text-white shadow-lg"><Star className="h-8 w-8 fill-current" /></div>
                        </div>
                         <div className="flex items-center justify-center h-20 w-20 rounded-full border-4 border-amber-400 font-bold text-2xl bg-background ml-1 mt-1">{level}</div>
                    </div>
                    <div className="flex-1 space-y-2">
                        <div className="flex justify-between items-baseline">
                            <CardTitle className="font-headline text-2xl">Level {level}</CardTitle>
                            <p className="text-sm font-mono text-muted-foreground">{totalXp} / {xpForNextLevel} XP</p>
                        </div>
                        <Progress value={progressPercentage} className="h-5 bg-muted border border-primary/20 shadow-inner" />
                        <p className="text-xs text-muted-foreground text-center pt-1">{xpToNextLevel} XP to next level</p>
                    </div>
                </div>
            </CardContent>
        </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
          <Avatar className="h-28 w-28 border-4 border-primary">
            <AvatarImage src={`https://picsum.photos/seed/${userProfile!.name}/120/120`}/>
            <AvatarFallback className="text-4xl">{userProfile!.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="space-y-4 flex-1">
            <div className='flex items-center gap-4 justify-center md:justify-start'>
                <CardTitle className="text-3xl font-headline">{userProfile!.name}</CardTitle>
                {!isOwnProfile && !isFollowingLoading && (
                    isFollowing ? (
                        <Button variant="secondary" onClick={handleUnfollow}><UserCheck className="mr-2" /> Following</Button>
                    ) : (
                        <Button onClick={handleFollow}><UserPlus className="mr-2" /> Follow</Button>
                    )
                )}
                 {isOwnProfile && <Button variant="outline" size="icon"><Settings /></Button>}
            </div>
            <div className="flex justify-center md:justify-start gap-6 text-center">
              <div><p className="text-xl font-bold">{totalQuizzes}</p><p className="text-sm text-muted-foreground">Quizzes</p></div>
              <div><p className="text-xl font-bold">{followers?.length || 0}</p><p className="text-sm text-muted-foreground">Followers</p></div>
              <div><p className="text-xl font-bold">{following?.length || 0}</p><p className="text-sm text-muted-foreground">Following</p></div>
            </div>
             <div className="text-left">
                {isEditingBio ? (
                    <div className='space-y-2'>
                        <Textarea value={bioText} onChange={(e) => setBioText(e.target.value)} placeholder="Tell us about yourself..." />
                        <div className='flex gap-2'>
                            <Button size="sm" onClick={handleSaveBio}><Check className='h-4 w-4 mr-1' /> Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setIsEditingBio(false)}>Cancel</Button>
                        </div>
                    </div>
                ) : (
                    <div className='flex items-start gap-2'>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap flex-1">{userProfile!.bio || (isOwnProfile && 'No bio yet. Add one!')}</p>
                        {isOwnProfile && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditingBio(true)}><Edit className='h-4 w-4'/></Button>}
                    </div>
                )}
            </div>
          </div>
        </CardHeader>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Achievements</CardTitle>
          <CardDescription>Badges you've earned on your learning adventure. (Coming soon!)</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {mockAchievements.map(ach => (
            <div key={ach.id} className={`flex flex-col items-center text-center p-4 rounded-lg border transition-opacity ${ach.unlocked ? 'opacity-100' : 'opacity-40'}`}>
              <ach.Icon className={`h-12 w-12 mb-2 ${ach.unlocked ? 'text-primary' : 'text-muted-foreground'}`}/>
              <p className="font-semibold text-sm">{ach.name}</p>
              <p className="text-xs text-muted-foreground">{ach.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Quiz History</CardTitle>
          <CardDescription>A log of {isOwnProfile ? 'your' : `${userProfile!.name}'s`} recent assessments.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quiz</TableHead>
                 <TableHead>XP Gained</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="text-center">Time Taken</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isHistoryLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
              ) : quizHistory && quizHistory.length > 0 ? (
                quizHistory.map(result => (<QuizHistoryRow key={result.id} result={result} />))
              ) : (
                <TableRow><TableCell colSpan={5} className="text-center">No quiz history yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
