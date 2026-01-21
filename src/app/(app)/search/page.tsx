'use client';

import { useState, useMemo } from 'react';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  WithId,
} from '@/firebase';
import {
  collection,
  query,
  where,
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
import { Loader2, SearchIcon, User } from 'lucide-react';
import Link from 'next/link';

interface UserProfile {
  name: string;
  bio: string;
}

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const firestore = useFirestore();

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !searchTerm) return null;
    // This query structure allows for "prefix" searching
    return query(
      collection(firestore, 'users'),
      orderBy('name'),
      startAt(searchTerm),
      endAt(searchTerm + '\uf8ff'),
      limit(10)
    );
  }, [firestore, searchTerm]);

  const { data: users, isLoading } =
    useCollection<UserProfile>(usersQuery);

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-3xl">
            Search Users
          </CardTitle>
          <CardDescription>
            Find your friends and classmates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 text-lg"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}

        {!isLoading && searchTerm && users?.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <h3 className="text-xl font-semibold">No Users Found</h3>
            <p>
              No users match your search for &quot;{searchTerm}&quot;.
            </p>
          </div>
        )}

        {!isLoading && users && users.length > 0 && (
          <div className="grid gap-4">
            {users.map((user) => (
              <Link href={`/profile?id=${user.id}`} key={user.id} className="block">
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4 flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                       <AvatarImage src={`https://picsum.photos/seed/${user.name}/80/80`} />
                       <AvatarFallback>
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-bold">{user.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{user.bio}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {!searchTerm && (
             <div className="text-center text-muted-foreground py-12">
                <User className="h-12 w-12 mx-auto mb-4"/>
                <h3 className="text-xl font-semibold">Search for a User</h3>
                <p>
                    Start typing in the search bar above to find someone.
                </p>
            </div>
        )}
      </div>
    </div>
  );
}
