'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
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
import {
  Loader2, Medal, Rocket, ShieldCheck, Target, Award, Star, Edit, Check, Settings,
  UserPlus, UserCheck, Zap, Trophy, Crown, Camera, X
} from 'lucide-react';
import { useEffect, useState, useMemo, useRef } from 'react';
import {
  useUser,
  useCollection,
  useFirestore,
  useMemoFirebase,
  useDoc,
  updateDocumentNonBlocking,
  addDocumentNonBlocking // Ensure this is available if needed
} from '@/firebase';
import { collection, query, orderBy, doc, DocumentReference, writeBatch, serverTimestamp, getDoc, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

// Types
interface StudentQuizResult {
  id: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  submissionDateTime: { seconds: number; nanoseconds: number };
  timeTaken: number;
  xpGained: number;
  accuracy?: string;
}

interface UserProfile {
  name: string;
  username?: string;
  totalXp: number;
  bio: string;
  photoURL?: string;
  userType?: 'student' | 'teacher';
}

interface Follow {
  userId: string;
  followedAt: any;
  name?: string; // Optimistic
  photoURL?: string; // Optimistic
}

// Game Logic
const XP_PER_LEVEL = 100;
const RANKS = [
  { name: 'Spark Novice', minLevel: 1, color: 'text-blue-500' },
  { name: 'Fusion Apprentice', minLevel: 5, color: 'text-violet-500' },
  { name: 'Quantum Adept', minLevel: 10, color: 'text-cyan-500' },
  { name: 'Cosmos Master', minLevel: 20, color: 'text-amber-500' },
  { name: 'Universal Legend', minLevel: 50, color: 'text-rose-500' }
];

function getRank(level: number) {
  return RANKS.slice().reverse().find(r => level >= r.minLevel) || RANKS[0];
}

function calculateLevel(totalXp: number) {
  if (totalXp < 0) totalXp = 0;
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpForCurrentLevel = (level - 1) * XP_PER_LEVEL;
  const xpForNextLevel = level * XP_PER_LEVEL;
  const xpProgress = totalXp - xpForCurrentLevel;
  const xpToNextLevel = xpForNextLevel - totalXp;
  /* const progressPercentage = (xpProgress / XP_PER_LEVEL) * 100; */ // Buggy
  const progressPercentage = Math.min(100, Math.max(0, (xpProgress / XP_PER_LEVEL) * 100));

  return { level, xpProgress, xpToNextLevel, progressPercentage, xpForNextLevel };
}

// Subcomponents

function FollowListDialog({
  title,
  triggerCount,
  userIds
}: {
  title: string,
  triggerCount: number,
  userIds: string[]
}) {
  const firestore = useFirestore();
  const [users, setUsers] = useState<{ id: string, name: string }[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !firestore || !userIds.length) return;

    const fetchUsers = async () => {
      try {
        const fetched = await Promise.all(userIds.map(async (uid) => {
          const docRef = doc(firestore, 'users', uid);
          const snap = await getDoc(docRef);
          // Fallback to "Unknown" if user deleted, or use UID if name missing
          return { id: uid, name: snap.exists() ? (snap.data().name || 'No Name') : 'Deleted User' };
        }));
        setUsers(fetched);
      } catch (e) { console.error(e); }
    };
    fetchUsers();
  }, [isOpen, userIds, firestore]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <div className="cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors text-center">
          <p className="text-xl font-bold">{triggerCount}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[300px] overflow-y-auto space-y-2">
          {userIds.length === 0 ? <p className="text-muted-foreground text-center py-4">No {title.toLowerCase()} yet.</p> : (
            users.length > 0 ? users.map((u) => (
              <div key={u.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={`https://picsum.photos/seed/${u.id}/40/40`} />
                  <AvatarFallback>{u.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{u.name}</span>
              </div>
            )) : <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AchievementBadge({
  label,
  desc,
  Icon,
  unlocked
}: {
  label: string,
  desc: string,
  Icon: any,
  unlocked: boolean
}) {
  return (
    <div className={`relative flex flex-col items-center text-center p-4 rounded-xl border-2 transition-all ${unlocked ? 'border-primary/50 bg-primary/5 shadow-md scale-105' : 'border-dashed border-muted bg-muted/10 opacity-60 grayscale'}`}>
      {unlocked && <div className="absolute top-2 right-2 text-yellow-500"><Star className="h-4 w-4 fill-current animate-pulse" /></div>}
      <div className={`h-14 w-14 rounded-full flex items-center justify-center mb-3 ${unlocked ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
        <Icon className="h-8 w-8" />
      </div>
      <p className="font-bold text-sm mb-1">{label}</p>
      <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
    </div>
  )
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
    if (quiz) setQuizName(quiz.name);
  }, [quiz]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50">
          <TableCell className="font-medium truncate max-w-[150px]">{quizName || 'Loading...'}</TableCell>
          <TableCell><Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">{result.xpGained} XP</Badge></TableCell>
          <TableCell className="font-bold">{result.score} / {result.totalQuestions}</TableCell>
          <TableCell className="text-center text-muted-foreground font-mono text-xs">{formatTime(result.timeTaken)}</TableCell>
          <TableCell className="text-right text-muted-foreground text-xs">{format(new Date(result.submissionDateTime.seconds * 1000), 'MMM dd, yyyy')}</TableCell>
        </TableRow>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">Quiz Review: {quizName}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="flex flex-col items-center p-3 bg-secondary rounded-lg">
            <span className="text-2xl font-bold">{result.score} / {result.totalQuestions}</span>
            <span className="text-xs text-muted-foreground uppercase tracking-widest">Score</span>
          </div>
          <div className="flex flex-col items-center p-3 bg-secondary rounded-lg">
            <span className="text-2xl font-bold text-amber-500">+{result.xpGained} XP</span>
            <span className="text-xs text-muted-foreground uppercase tracking-widest">Experience</span>
          </div>
        </div>
        {result.accuracy && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm"><span>Accuracy</span><span>{result.accuracy}%</span></div>
            <Progress value={parseFloat(result.accuracy)} />
          </div>
        )}
        <div className="text-center text-sm text-muted-foreground pt-4">
          Full question review coming soon.
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Main Component

export default function ProfileClientView({ userId: profileUserIdProp }: { userId: string | null }) {
  const { user: currentUser, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileUserId = useMemo(() => profileUserIdProp || (currentUser ? currentUser.uid : null), [profileUserIdProp, currentUser]);
  const isOwnProfile = currentUser?.uid === profileUserId;

  // Refs
  const userProfileRef = useMemoFirebase(
    () => (firestore && profileUserId ? doc(firestore, 'users', profileUserId) as DocumentReference<UserProfile> : null),
    [firestore, profileUserId]
  );

  // Data Fetching
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

  // Sync Bio
  useEffect(() => {
    if (userProfile?.bio) setBioText(userProfile.bio);
  }, [userProfile?.bio]);

  // Admin Cleanup
  const handleAdminCleanup = async () => {
    if (userProfile?.username !== 'tilak_041' || !firestore || !currentUser) return;
    if (!window.confirm("DANGER: This will delete ALL other users and ALL posts in the system. Are you sure?")) return;

    try {
      // Delete Users
      const usersRef = collection(firestore, 'users');
      const userSnapshot = await getDocs(usersRef);
      const userBatch = writeBatch(firestore);
      let userCount = 0;

      userSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (doc.id === currentUser.uid || data.username === 'tilak_041') return;
        userBatch.delete(doc.ref);
        userCount++;
      });
      await userBatch.commit();

      // Delete Posts
      const postsRef = collection(firestore, 'posts');
      const postSnapshot = await getDocs(postsRef);
      const postBatch = writeBatch(firestore);
      let postCount = 0;

      postSnapshot.docs.forEach((doc) => {
        postBatch.delete(doc.ref);
        postCount++;
      });
      await postBatch.commit();

      alert(`Admin Cleanup Complete.\nDeleted ${userCount} users.\nDeleted ${postCount} posts.`);
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Cleanup failed. See console.");
    }
  }

  // Actions
  const handleSaveBio = () => {
    if (isOwnProfile && userProfileRef) {
      updateDocumentNonBlocking(userProfileRef, { bio: bioText });
      setIsEditingBio(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfileRef) return;

    // Size Limit Check (100KB to be safe)
    if (file.size > 100 * 1024) {
      alert("Image too large! Please choose an image under 100KB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Update firestore
      updateDocumentNonBlocking(userProfileRef, { photoURL: base64String });
      setUploadingPhoto(false);
    };
    setUploadingPhoto(true);
    reader.readAsDataURL(file);
  };

  const handleFollow = async () => {
    if (!currentUser || !profileUserId || !firestore || isOwnProfile) return;

    const batch = writeBatch(firestore);

    const followingDocRef = doc(firestore, 'users', currentUser.uid, 'following', profileUserId);
    batch.set(followingDocRef, {
      userId: profileUserId,
      followedAt: serverTimestamp(),
      // Store metadata optimistically
      name: userProfile?.name || ''
    });

    const followerDocRef = doc(firestore, 'users', profileUserId, 'followers', currentUser.uid);
    batch.set(followerDocRef, {
      userId: currentUser.uid,
      followedAt: serverTimestamp(),
      name: currentUser.displayName || ''
    });

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

  if (isProfileLoading || !userProfile) return <div className="flex h-full w-full items-center justify-center min-h-[500px]"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  // Computed Stats
  const totalXp = userProfile.totalXp || 0;
  const { level, xpToNextLevel, progressPercentage, xpForNextLevel } = calculateLevel(totalXp);
  const rank = getRank(level);

  // Real Achievements logic
  const achievements = [
    {
      id: 'first_step', label: 'First Step', desc: 'Completed your first quiz.', Icon: Rocket,
      unlocked: (quizHistory?.length || 0) >= 1
    },
    {
      id: 'quiz_master', label: 'Quiz Master', desc: 'Completed 5+ quizzes.', Icon: Crown,
      unlocked: (quizHistory?.length || 0) >= 5
    },
    {
      id: 'perfectionist', label: 'Perfectionist', desc: 'Got a 100% score.', Icon: Target,
      unlocked: quizHistory?.some(q => q.score === q.totalQuestions) || false
    },
    {
      id: 'veteran', label: 'Veteran', desc: 'Reached Level 10.', Icon: Medal,
      unlocked: level >= 10
    }
  ];

  // Admin: Clear Posts
  const handleClearPosts = async () => {
    if (userProfile?.username !== 'tilak_041' || !firestore) return;
    if (!window.confirm("CONFIRM: Delete ALL posts in the system? Users will remain.")) return;

    try {
      const postsRef = collection(firestore, 'posts');
      const snapshot = await getDocs(postsRef);
      const batch = writeBatch(firestore);
      snapshot.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      alert(`Deleted ${snapshot.size} posts.`);
      window.location.reload();
    } catch (e) { console.error(e); alert("Failed."); }
  }

  return (
    <div className="flex-1 max-w-5xl mx-auto p-4 md:p-8 space-y-8">

      {/* Header Card */}
      <Card className="overflow-hidden border-none shadow-xl bg-gradient-to-br from-card to-background">
        {/* Banner */}
        <div className="h-32 bg-gradient-to-r from-primary via-indigo-500 to-purple-600 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        </div>

        <CardContent className="relative px-8 pb-8 pt-0 flex flex-col md:flex-row gap-6 items-center md:items-end -mt-12">
          {/* Profile Photo */}
          <div className="relative group">
            <Avatar className="h-32 w-32 border-4 border-background shadow-2xl">
              <AvatarImage src={userProfile.photoURL || `https://picsum.photos/seed/${userProfile.name}/200/200`} className="object-cover" />
              <AvatarFallback className="text-4xl bg-secondary">{userProfile.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            {isOwnProfile && (
              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <Camera className="text-white h-8 w-8" />
              </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
          </div>

          {/* Basic Info */}
          <div className="flex-1 text-center md:text-left space-y-1">
            <h1 className="text-3xl md:text-4xl font-extrabold font-headline">{userProfile.name}</h1>
            <p className="text-muted-foreground font-medium">@{userProfile.username || 'user'}</p>

            {!isOwnProfile && (
              <div className="pt-2">
                <Button
                  size="sm"
                  className={isFollowing ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" : ""}
                  onClick={isFollowing ? handleUnfollow : handleFollow}
                >
                  {isFollowing ? <><UserCheck className="mr-2 h-4 w-4" /> Following</> : <><UserPlus className="mr-2 h-4 w-4" /> Follow</>}
                </Button>
              </div>
            )}
          </div>

          {/* Social Stats */}
          <div className="flex gap-4 bg-muted/30 p-2 rounded-xl border border-white/5 backdrop-blur-sm">
            <FollowListDialog title="Followers" triggerCount={followers?.length || 0} userIds={followers?.map(f => f.userId) || []} />
            <div className="w-[1px] bg-border my-2"></div>
            <FollowListDialog title="Following" triggerCount={following?.length || 0} userIds={following?.map(f => f.userId) || []} />
            <div className="w-[1px] bg-border my-2"></div>
            <div className="p-2 text-center min-w-[3rem]">
              <p className="text-xl font-bold">{quizHistory?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Quizzes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Left Col: Stats & Bio */}
        <div className="space-y-6">
          {/* Level Card */}
          <Card className="bg-gradient-to-br from-background to-secondary/10 border-primary/20 shadow-md">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2"><Trophy className="text-amber-400 fill-current" /> Level {level}</CardTitle>
                <Badge variant="outline" className={`${rank.color} border-current/30`}>{rank.name}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono text-muted-foreground">
                  <span>{totalXp} XP</span>
                  <span>{xpForNextLevel} XP</span>
                </div>
                <Progress value={progressPercentage} className="h-3" />
                <p className="text-xs text-center text-muted-foreground pt-1">{xpToNextLevel} XP to next rank</p>
              </div>

              <div className="pt-4 border-t">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Crown className="h-4 w-4 text-purple-500" /> Rank Journey</h4>
                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                  {RANKS.map((r) => (
                    <div key={r.name} className={`flex items-center justify-between text-xs p-2 rounded ${level >= r.minLevel ? 'bg-primary/10 text-foreground' : 'text-muted-foreground opacity-50'}`}>
                      <span className="font-medium">{r.name}</span>
                      <span>Lv {r.minLevel}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bio Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">About</CardTitle>
              {isOwnProfile && !isEditingBio && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditingBio(true)}><Edit className="h-4 w-4" /></Button>
              )}
            </CardHeader>
            <CardContent>
              {isEditingBio ? (
                <div className='space-y-2'>
                  <Textarea value={bioText} onChange={(e) => setBioText(e.target.value)} placeholder="Tell the world about your mission..." className="min-h-[100px]" />
                  <div className='flex gap-2 justify-end'>
                    <Button size="sm" variant="outline" onClick={() => setIsEditingBio(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveBio}>Save</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{userProfile.bio || "No bio added yet."}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Achievements & History */}
        <div className="md:col-span-2 space-y-6">

          {/* Achievements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Award className="text-primary" /> Achievements</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {achievements.map(ach => (
                <AchievementBadge key={ach.id} {...ach} />
              ))}
            </CardContent>
          </Card>

          {/* Quiz History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Zap className="text-yellow-500 fill-current" /> Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quiz</TableHead>
                    <TableHead>XP</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-center">Time</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quizHistory && quizHistory.length > 0 ? (
                    quizHistory.map(result => (<QuizHistoryRow key={result.id} result={result} />))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No quizzes taken yet. Go to Library to start!</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Admin Zone */}
      {userProfile.username === 'tilak_041' && isOwnProfile && (
        <div className="flex flex-col gap-3 items-center pt-8 border-t w-full">
          <h3 className="text-sm font-bold uppercase text-muted-foreground">Admin Danger Zone</h3>
          <div className="flex gap-4">
            <Button variant="outline" className="border-destructive text-destructive" onClick={handleClearPosts}>
              🗑️ Clear All Posts
            </Button>
            <Button variant="destructive" onClick={handleAdminCleanup}>
              ⚠️ Wipe Users & Posts
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Utility styling for scrollbar
/* 
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #888; 
  border-radius: 2px;
}
*/
