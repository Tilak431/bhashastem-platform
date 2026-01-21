'use client';

import { useState, useEffect } from 'react';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  WithId,
} from '@/firebase';
import {
  collection,
  query,
  limit,
  startAt,
  endAt,
  orderBy,
} from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, SearchIcon, User, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface UserProfile {
  name: string;
  bio?: string;
  role?: string; // Optimistic
  createdAt?: any;
}

// Debounce Hook logic
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300); // 300ms delay
  const firestore = useFirestore();

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !debouncedSearchTerm.trim()) return null;

    // Capitalize first letter for better matching if names are Title Case
    // Or just pass raw term if validation handles it. 
    // We'll stick to raw term prefix search.
    const term = debouncedSearchTerm;

    return query(
      collection(firestore, 'users'),
      orderBy('name'),
      startAt(term),
      endAt(term + '\uf8ff'),
      limit(20) // Increased limit
    );
  }, [firestore, debouncedSearchTerm]);

  const { data: users, isLoading } =
    useCollection<UserProfile>(usersQuery);

  return (
    <div className="flex-1 w-full min-h-screen bg-transparent p-4 md:p-8 max-w-5xl mx-auto">

      {/* Search Header */}
      <div className="mb-8 space-y-4">
        <h1 className="text-4xl font-extrabold font-headline bg-clip-text text-transparent bg-gradient-to-r from-primary to-cyan-500">
          Discover People
        </h1>
        <p className="text-muted-foreground text-lg">
          Connect with students and teachers in the community.
        </p>

        <div className="relative max-w-2xl">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <SearchIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <Input
            placeholder="Search by name..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-12 h-14 text-lg rounded-full border-primary/20 bg-background/50 backdrop-blur-md focus-visible:ring-primary/50 shadow-sm transition-all hover:bg-background/80 hover:shadow-md"
          />
          {isLoading && (
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Results Section */}
      <div className="space-y-6">

        {!isLoading && debouncedSearchTerm && users?.length === 0 && (
          <Card className="text-center p-12 border-dashed bg-transparent">
            <div className="flex flex-col items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <User className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-xl font-semibold">No results found</h3>
              <p className="text-muted-foreground">
                We couldn't find any users named "{debouncedSearchTerm}".
              </p>
            </div>
          </Card>
        )}

        {!isLoading && users && users.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map((user) => (
              <Link href={`/profile?id=${user.id}`} key={user.id} className="group block h-full">
                <Card className="h-full border border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  <CardContent className="p-6 flex flex-col items-center text-center relative z-10">
                    <Avatar className="h-20 w-20 mb-4 ring-2 ring-border group-hover:ring-primary/50 transition-all shadow-md">
                      <AvatarImage src={`https://picsum.photos/seed/${user.name}/200/200`} />
                      <AvatarFallback className="text-xl bg-primary/10 text-primary">
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="space-y-1 w-full mb-4">
                      <h3 className="font-bold text-lg truncate px-2 group-hover:text-primary transition-colors">{user.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5em]">
                        {user.bio || "No bio yet"}
                      </p>
                    </div>

                    <div className="w-full mt-auto pt-4 border-t border-border/40 flex justify-between items-center">
                      <Badge variant="secondary" className="bg-secondary/50">
                        Student
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center group-hover:text-primary transition-colors font-medium">
                        View Profile <User className="ml-1 h-3 w-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {!debouncedSearchTerm && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-12 opacity-50">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-2xl border-2 border-dashed border-muted bg-muted/10 animate-pulse flex items-center justify-center">
                <User className="h-12 w-12 text-muted-foreground/20" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
