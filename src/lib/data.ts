import {
  BiologyIcon,
  ChemistryIcon,
  MathIcon,
  PhysicsIcon,
} from '@/components/common/SubjectIcons';

export type Subject = 'Physics' | 'Chemistry' | 'Biology' | 'Math';
export type Language = 'English' | 'Hindi' | 'Tamil' | 'Bengali' | 'Kannada';

export interface Quiz {
  id: string;
  title: string;
  subject: Subject;
  questionCount: number;
}

export interface ProgressData {
  month: string;
  conceptsMastered: number;
  quizzesCompleted: number;
}

export const quizzes: Quiz[] = [
  { id: 'q1', title: 'Kinematics Challenge', subject: 'Physics', questionCount: 15 },
  { id: 'q2', title: 'Periodic Table Test', subject: 'Chemistry', questionCount: 20 },
  { id: 'q3', title: 'Genetics and Evolution', subject: 'Biology', questionCount: 25 },
  { id: 'q4', title: 'Algebra Fundamentals', subject: 'Math', questionCount: 10 },
];

export const progressData: ProgressData[] = [
  { month: 'Jan', conceptsMastered: 10, quizzesCompleted: 4 },
  { month: 'Feb', conceptsMastered: 12, quizzesCompleted: 5 },
  { month: 'Mar', conceptsMastered: 15, quizzesCompleted: 6 },
  { month: 'Apr', conceptsMastered: 14, quizzesCompleted: 5 },
  { month: 'May', conceptsMastered: 18, quizzesCompleted: 7 },
  { month: 'Jun', conceptsMastered: 22, quizzesCompleted: 9 },
];

export const languages: Language[] = ['English', 'Hindi', 'Tamil', 'Bengali', 'Kannada'];
export const subjects: Subject[] = ['Physics', 'Chemistry', 'Biology', 'Math'];
