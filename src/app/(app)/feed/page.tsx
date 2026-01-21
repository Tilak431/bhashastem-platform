
'use client';

import {
  addDocumentNonBlocking,
  useCollection,
  useFirestore,
  useMemoFirebase,
  useUser,
  WithId,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
  useDoc,
} from '@/firebase';
import {
  collection,
  query,
  orderBy,
  serverTimestamp,
  doc,
  writeBatch,
  increment,
  runTransaction,
  getDocs,
} from 'firebase/firestore';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Heart,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import Link from 'next/link';
import { useState, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"


interface Post {
  userId: string;
  content?: string;
  imageUrl?: string;
  createdAt: { seconds: number; nanoseconds: number };
  likeCount: number;
  commentCount: number;
}

interface UserProfile {
  name: string;
}

interface Comment {
  userId: string;
  content: string;
  createdAt: { seconds: number; nanoseconds: number };
}

const createPostSchema = z.object({
  content: z.string().max(280),
});

function PostAuthor({ userId }: { userId: string }) {
  const firestore = useFirestore();
  const userRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'users', userId) : null),
    [firestore, userId]
  );
  const { data: userProfile, isLoading } = useDoc<UserProfile>(userRef);

  if (isLoading || !userProfile) {
    return (
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback>
            <UserIcon />
          </AvatarFallback>
        </Avatar>
        <p className="font-semibold text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <Link href={`/profile?id=${userId}`} className="flex items-center gap-3">
      <Avatar className="h-10 w-10">
        <AvatarImage
          src={`https://picsum.photos/seed/${userProfile.name}/40/40`}
        />
        <AvatarFallback>{userProfile.name.charAt(0)}</AvatarFallback>
      </Avatar>
      <p className="font-semibold text-sm hover:underline">{userProfile.name}</p>
    </Link>
  );
}

function CommentAuthor({ userId }: { userId: string }) {
  const firestore = useFirestore();
  const userRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'users', userId) : null),
    [firestore, userId]
  );
  const { data: userProfile } = useDoc<UserProfile>(userRef);

  return (
    <Link
      href={`/profile?id=${userId}`}
      className="font-semibold text-xs hover:underline"
    >
      {userProfile?.name || '...'}
    </Link>
  );
}

function PostComments({ postId }: { postId: string }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [comment, setComment] = useState('');

  const commentsQuery = useMemoFirebase(
    () =>
      firestore
        ? query(
            collection(firestore, 'posts', postId, 'comments'),
            orderBy('createdAt', 'asc')
          )
        : null,
    [firestore, postId]
  );
  const { data: comments, isLoading } =
    useCollection<Comment>(commentsQuery);

  const handleAddComment = async () => {
    if (!comment.trim() || !user || !firestore) return;
    const postRef = doc(firestore, 'posts', postId);
    const commentsRef = collection(postRef, 'comments');
    
    addDocumentNonBlocking(commentsRef, {
      userId: user.uid,
      content: comment,
      createdAt: serverTimestamp(),
    });

    updateDocumentNonBlocking(postRef, {
        commentCount: increment(1)
    });

    setComment('');
  };

  return (
    <div className="space-y-3 pt-4 border-t mt-4">
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {!isLoading &&
        comments?.map(comment => (
          <div key={comment.id} className="text-xs flex gap-2">
            <CommentAuthor userId={comment.userId} />
            <p className="text-muted-foreground">{comment.content}</p>
          </div>
        ))}
      {user && (
        <div className="flex items-center gap-2 pt-2">
          <Input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a comment..."
            className="h-8 text-xs"
          />
          <Button
            size="sm"
            onClick={handleAddComment}
            disabled={!comment.trim()}
          >
            Post
          </Button>
        </div>
      )}
    </div>
  );
}

function PostCard({ post }: { post: WithId<Post> }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [showComments, setShowComments] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const likeRef = useMemoFirebase(
    () =>
      user && firestore
        ? doc(firestore, 'posts', post.id, 'likes', user.uid)
        : null,
    [firestore, user, post.id]
  );
  const { data: likeDoc, isLoading: isLikeLoading } = useDoc(likeRef);
  const isLiked = !!likeDoc;

  const handleLike = async () => {
    if (!user || !firestore || !likeRef) return;
    const postRef = doc(firestore, 'posts', post.id);

    try {
      await runTransaction(firestore, async transaction => {
        const remoteLikeDoc = await transaction.get(likeRef);
        
        if (remoteLikeDoc.exists()) {
          transaction.update(postRef, { likeCount: increment(-1) });
          transaction.delete(likeRef);
        } else {
          transaction.update(postRef, { likeCount: increment(1) });
          transaction.set(likeRef, { userId: user.uid });
        }
      });
    } catch (e) {
      console.error("Transaction failed: ", e);
    }
  };

  const handleDelete = async () => {
      if (!user || user.uid !== post.userId || !firestore) return;
      setIsDeleting(true);

      const postRef = doc(firestore, "posts", post.id);
      
      try {
        const batch = writeBatch(firestore);

        // Delete comments subcollection
        const commentsRef = collection(postRef, 'comments');
        const commentsSnapshot = await getDocs(commentsRef);
        commentsSnapshot.forEach((commentDoc) => {
            batch.delete(commentDoc.ref);
        });

        // Delete likes subcollection
        const likesRef = collection(postRef, 'likes');
        const likesSnapshot = await getDocs(likesRef);
        likesSnapshot.forEach((likeDoc) => {
            batch.delete(likeDoc.ref);
        });

        // Delete the post itself
        batch.delete(postRef);

        await batch.commit();

      } catch(e) {
        console.error("Error deleting post:", e);
        setIsDeleting(false);
      }
  }

  const timeAgo = post.createdAt
    ? formatDistanceToNow(new Date(post.createdAt.seconds * 1000), {
        addSuffix: true,
      })
    : 'just now';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <PostAuthor userId={post.userId} />
           <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
            {user && user.uid === post.userId && (
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" disabled={isDeleting}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete your post.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                          {isDeleting ? <Loader2 className="animate-spin" /> : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
           </div>
        </div>
      </CardHeader>
      <CardContent>
        {post.content && <p className="text-sm whitespace-pre-wrap">{post.content}</p>}
        {post.imageUrl && (
            <div className="mt-4 relative w-full rounded-lg overflow-hidden border">
                <Image src={post.imageUrl} alt="Post image" width={0} height={0} sizes="100vw" style={{ width: '100%', height: 'auto' }} className="object-contain" />
            </div>
        )}
      </CardContent>
      <CardFooter className="flex-col items-start gap-2">
        <div className="flex gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            disabled={!user || isLikeLoading}
            className="flex items-center gap-1.5"
          >
            <Heart
              className={`h-4 w-4 ${isLiked ? 'text-red-500 fill-current' : ''}`}
            />
            <span className="text-xs">{post.likeCount || 0}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs">{post.commentCount || 0}</span>
          </Button>
        </div>
        {showComments && <PostComments postId={post.id} />}
      </CardFooter>
    </Card>
  );
}

function CreatePost() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof createPostSchema>>({
    resolver: zodResolver(createPostSchema),
    defaultValues: { content: '' },
  });

  const { isSubmitting } = form.formState;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setImageDataUri(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageDataUri(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  }


  const onSubmit = async (values: z.infer<typeof createPostSchema>) => {
    if (!user || !firestore) return;
    if (!values.content && !imageDataUri) {
        form.setError("content", { type: "manual", message: "A post must have either text or an image." });
        return;
    }

    const postsRef = collection(firestore, 'posts');
    addDocumentNonBlocking(postsRef, {
      userId: user.uid,
      content: values.content,
      imageUrl: imageDataUri,
      createdAt: serverTimestamp(),
      likeCount: 0,
      commentCount: 0,
    });
    form.reset();
    removeImage();
  };

  if (!user) return null;

  return (
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle className="text-xl font-headline">Create Post</CardTitle>
            <CardDescription>
              Share your progress, achievements, or ask a question.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder={`What's on your mind, ${user.displayName}?`}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {imagePreview && (
                 <div className="relative w-full">
                    <Image src={imagePreview} alt="Image preview" width={0} height={0} sizes="100vw" style={{ width: '100%', height: 'auto' }} className="rounded-md object-contain" />
                    <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={removeImage}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
             <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="h-4 w-4" />
                <span className="sr-only">Attach image</span>
             </Button>
             <Input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/jpg" />
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Post
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

export default function FeedPage() {
  const firestore = useFirestore();
  const postsQuery = useMemoFirebase(
    () =>
      firestore
        ? query(collection(firestore, 'posts'), orderBy('createdAt', 'desc'))
        : null,
    [firestore]
  );
  const { data: posts, isLoading } = useCollection<Post>(postsQuery);

  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <CreatePost />
        <div className="space-y-4">
          {isLoading && (
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
          {posts?.map(post => <PostCard key={post.id} post={post} />)}
          {!isLoading && posts?.length === 0 && (
            <Card className="text-center p-8">
              <p className="text-muted-foreground">
                No posts yet. Be the first to share something!
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
