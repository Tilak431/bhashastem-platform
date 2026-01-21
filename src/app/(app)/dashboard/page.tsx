
'use client';

import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  ClipboardCheck,
  Library,
  MessageCircle,
  Loader2,
  Star,
  Rss,
  Search,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { useUser, useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Progress } from '@/components/ui/progress';

const quickActions = [
    {
    title: 'Browse Library',
    description: 'Explore videos, articles, and simulations.',
    href: '/library',
    icon: Library,
  },
  {
    title: 'Take a Quiz',
    description: 'Test your knowledge and identify learning gaps.',
    href: '/quizzes',
    icon: ClipboardCheck,
  },
  {
    title: 'Ask our AI',
    description: 'Get answers to your STEM questions instantly.',
    href: '/ask',
    icon: MessageCircle,
  },
  {
    title: 'Community Feed',
    description: 'Connect with peers and share your progress.',
    href: '/feed',
    icon: Rss,
  },
  {
    title: 'Search Users',
    description: 'Find and connect with your classmates.',
    href: '/search',
    icon: Search,
  },
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


function processProgressData(quizHistory: StudentQuizResult[] | null) {
  if (!quizHistory) return [];

  const monthlyData: Record<string, { quizzesCompleted: number; xpGained: number }> = {};

  quizHistory.forEach(result => {
    const date = new Date(result.submissionDateTime.seconds * 1000);
    const month = date.toLocaleString('default', { month: 'short' });
    
    if (!monthlyData[month]) {
      monthlyData[month] = { quizzesCompleted: 0, xpGained: 0 };
    }
    
    monthlyData[month].quizzesCompleted += 1;
    monthlyData[month].xpGained += result.xpGained;
  });

  // Get last 6 months
  const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
    const dateA = new Date(`${a} 1, 2000`);
    const dateB = new Date(`${b} 1, 2000`);
    return dateA.getTime() - dateB.getTime();
  }).slice(-6);


  return sortedMonths.map(month => ({
    month,
    quizzesCompleted: monthlyData[month].quizzesCompleted,
    xpGained: monthlyData[month].xpGained,
  }));
}


export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const resultsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'studentQuizResults'), orderBy('submissionDateTime', 'desc'));
  }, [firestore, user]);

  const userProfileRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);

  const { data: quizHistory, isLoading: isHistoryLoading } = useCollection<StudentQuizResult>(resultsQuery);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  const progressData = processProgressData(quizHistory);
  const isLoading = isHistoryLoading || isProfileLoading;

  const totalXp = userProfile?.totalXp || 0;
  const { level, xpToNextLevel, progressPercentage, xpForNextLevel } = calculateLevel(totalXp);


  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight font-headline">
          Welcome back, {userProfile?.name || 'Student'}!
        </h2>
      </div>

       <Card className="overflow-hidden">
            <CardHeader className="p-0"><div className="bg-gradient-to-r from-primary to-accent h-2" /></CardHeader>
            <CardContent className="p-6">
                 {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : (
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
                )}
            </CardContent>
        </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {quickActions.map(action => (
          <Card
            key={action.title}
            className="hover:shadow-lg transition-shadow duration-300"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-medium font-headline">
                {action.title}
              </CardTitle>
              <action.icon className="h-6 w-6 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {action.description}
              </p>
              <Button asChild variant="link" className="px-0 mt-2">
                <Link href={action.href}>
                  Go to section <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Progress Overview</CardTitle>
          <CardDescription>
            Your learning journey over the past 6 months.
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
           {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : (
          <ChartContainer
            config={{
              xpGained: {
                label: 'XP Gained',
                color: 'hsl(var(--primary))',
              },
              quizzesCompleted: {
                label: 'Quizzes Completed',
                color: 'hsl(var(--accent))',
              },
            }}
            className="h-[300px] w-full"
          >
            <ResponsiveContainer>
              <BarChart data={progressData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <YAxis />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                />
                <Bar
                  dataKey="xpGained"
                  fill="var(--color-xpGained)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="quizzesCompleted"
                  fill="var(--color-quizzesCompleted)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
