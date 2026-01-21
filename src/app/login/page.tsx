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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth, setDocumentNonBlocking, useFirestore } from '@/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  AuthError
} from 'firebase/auth';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { doc, getDocs, collection, query, where, getDoc } from 'firebase/firestore';

const TEACHER_KEY = 'teacher-secret-key';
const STUDENT_KEY = 'student-access-key';
const EMAIL_DOMAIN = '@bhashastem.app';

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();

  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  // Form States
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [accessKey, setAccessKey] = useState(''); // Only for signup
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Toggle Password Visibility
  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
    setError('');
    setLoading(true);

    try {
      const email = `${username.toLowerCase()}${EMAIL_DOMAIN}`;
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // Fetch user role from Firestore to set in localStorage (for immediate UI needs)
      const userDocRef = doc(firestore, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        localStorage.setItem('userType', userData.userType || 'student');
        localStorage.setItem('userName', userData.name || username);
      } else {
        // Fallback if doc missing (shouldn't happen)
        localStorage.setItem('userType', 'student');
      }

      router.push('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid username or password.');
      } else {
        setError(err.message || 'Login failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
    setError('');
    setLoading(true);

    // 1. Validation
    if (!username.trim() || username.length < 3) {
      setError("Username must be at least 3 characters.");
      setLoading(false);
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }
    if (!name.trim()) {
      setError("Please enter your full name.");
      setLoading(false);
      return;
    }

    // 2. Validate Access Key
    let userType: 'teacher' | 'student';
    if (accessKey === TEACHER_KEY) {
      userType = 'teacher';
    } else if (accessKey === STUDENT_KEY) {
      userType = 'student';
    } else {
      setError('Invalid Access Key. Please ask your administrator.');
      setLoading(false);
      return;
    }

    try {
      // 3. Check Username Uniqueness
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('username', '==', username.toLowerCase()));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        setError("Username is already taken. Please choose another.");
        setLoading(false);
        return;
      }

      // 4. Create Auth User
      const email = `${username.toLowerCase()}${EMAIL_DOMAIN}`;
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      await updateProfile(userCredential.user, { displayName: name });

      // 5. Create Firestore Doc (Initialize XP here)
      const userDocRef = doc(firestore, 'users', userCredential.user.uid);
      await setDocumentNonBlocking(userDocRef, {
        id: userCredential.user.uid,
        name: name,
        username: username.toLowerCase(), // Store username for future checks
        email: email,
        userType: userType,
        totalXp: 0, // Start with 0 XP
        bio: `Hi, I am ${name}!`,
        createdAt: new Date().toISOString()
      });

      localStorage.setItem('userType', userType);
      localStorage.setItem('userName', name);

      router.push('/dashboard');

    } catch (err: any) {
      console.error('Signup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This username is already registered.');
      } else {
        setError(err.message || 'Signup failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md shadow-lg border-primary/10">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
            BhashaSTEM
          </CardTitle>
          <CardDescription>
            Your gateway to sci-fi learning.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">Username</Label>
                  <Input
                    id="login-username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="bg-secondary/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-secondary/20 pr-10"
                    />
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-sm text-destructive font-medium">{error}</p>}
                <Button type="submit" className="w-full font-bold" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Login
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    placeholder="e.g. Tilak"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="bg-secondary/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-username">Choose Username</Label>
                  <Input
                    id="signup-username"
                    placeholder="unique_username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} // Restrict special chars
                    required
                    className="bg-secondary/20"
                  />
                  <p className="text-[10px] text-muted-foreground">Letters, numbers, and underscores only.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Create Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-secondary/20 pr-10"
                    />
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-key">Join Code (Access Key)</Label>
                  <Input
                    id="signup-key"
                    type="password"
                    placeholder="Ask your teacher"
                    value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)}
                    required
                    className="bg-secondary/20"
                  />
                </div>
                {error && <p className="text-sm text-destructive font-medium">{error}</p>}
                <Button type="submit" className="w-full font-bold" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
