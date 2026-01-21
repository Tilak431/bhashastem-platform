
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { useAuth, setDocumentNonBlocking } from '@/firebase';
import { signInAnonymously, updateProfile } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { doc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

const TEACHER_KEY = 'teacher-secret-key';
const STUDENT_KEY = 'student-access-key';

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const [name, setName] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);

    if (!name.trim() || !accessKey.trim()) {
      setError('Please enter your name and access key.');
      setLoading(false);
      return;
    }
    
    if (!auth || !firestore) {
        setError('Auth or Firestore service is not available. Please try again later.');
        setLoading(false);
        return;
    }

    let userType: 'teacher' | 'student';
    if (accessKey === TEACHER_KEY) {
        userType = 'teacher';
    } else if (accessKey === STUDENT_KEY) {
        userType = 'student';
    } else {
        setError('Invalid access key.');
        setLoading(false);
        return;
    }

    try {
      const userCredential = await signInAnonymously(auth);
      await updateProfile(userCredential.user, { displayName: name });
      
      // Create user profile document
       const userDocRef = doc(firestore, 'users', userCredential.user.uid);
       setDocumentNonBlocking(userDocRef, {
            id: userCredential.user.uid,
            name: name,
            email: userCredential.user.email || '',
            userType: userType,
            totalXp: 0,
            bio: 'Welcome to my BhashaSTEM profile!',
       }, { merge: true });
      
      // This is a temporary client-side solution for role-based UI
      localStorage.setItem('userType', userType);
      localStorage.setItem('userName', name);
      
      router.push('/dashboard');

    } catch (e: any) {
      console.error('Login failed:', e);
      setError(e.message || 'An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">
            Welcome to BhashaSTEM
          </CardTitle>
          <CardDescription>
            Enter your name and access key to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="access-key">Access Key</Label>
            <Input
              id="access-key"
              type="password"
              placeholder="Enter your key"
              value={accessKey}
              onChange={e => setAccessKey(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={handleLogin} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enter Class Section
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
