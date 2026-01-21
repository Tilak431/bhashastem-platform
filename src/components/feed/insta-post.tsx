"use client";

import {
    Heart,
    MessageCircle,
    MoreHorizontal,
    Send,
    Bookmark,
    Trash2,
    Loader2,
    User as UserIcon,
    X
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { useState, useRef } from "react";
import {
    useFirestore,
    useUser,
    useDoc,
    useMemoFirebase,
    addDocumentNonBlocking,
    updateDocumentNonBlocking,
    deleteDocumentNonBlocking,
    useCollection
} from "@/firebase";
import {
    doc,
    runTransaction,
    increment,
    writeBatch,
    collection,
    query,
    orderBy,
    serverTimestamp,
    getDocs
} from "firebase/firestore";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export interface Post {
    id: string;
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

function PostHeader({ userId, ownerId, postId, onDelete }: { userId: string, ownerId: string, postId: string, onDelete: () => void }) {
    const firestore = useFirestore();
    const userRef = useMemoFirebase(
        () => (firestore ? doc(firestore, "users", userId) : null),
        [firestore, userId]
    );
    const { data: userProfile } = useDoc<UserProfile>(userRef);
    const { user } = useUser();
    const isOwner = user?.uid === userId;

    return (
        <div className="flex items-center justify-between p-3">
            <div className="flex items-center space-x-3">
                <Link href={`/profile?id=${userId}`}>
                    <Avatar className="h-8 w-8 ring-2 ring-primary/10">
                        <AvatarImage
                            src={`https://picsum.photos/seed/${userProfile?.name || userId}/40/40`}
                        />
                        <AvatarFallback>
                            <UserIcon className="h-4 w-4" />
                        </AvatarFallback>
                    </Avatar>
                </Link>
                <div className="flex flex-col">
                    <Link href={`/profile?id=${userId}`} className="text-sm font-semibold hover:text-primary transition-colors">
                        {userProfile?.name || "Loading..."}
                    </Link>
                </div>
            </div>

            {isOwner && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Post?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    );
}

function CommentAuthor({
    userId,
    content,
    postId,
    commentId
}: {
    userId: string,
    content: string,
    postId?: string,
    commentId?: string
}) {
    const firestore = useFirestore();
    const { user } = useUser();
    const userRef = useMemoFirebase(
        () => (firestore ? doc(firestore, 'users', userId) : null),
        [firestore, userId]
    );
    const { data: userProfile } = useDoc<UserProfile>(userRef);

    const handleDelete = async () => {
        if (!firestore || !postId || !commentId) return;
        // eslint-disable-next-line no-restricted-globals
        if (!confirm("Delete this comment?")) return;

        const commentRef = doc(firestore, 'posts', postId, 'comments', commentId);
        const postRef = doc(firestore, 'posts', postId);

        await deleteDocumentNonBlocking(commentRef);
        updateDocumentNonBlocking(postRef, { commentCount: increment(-1) });
    };

    const isAuthor = user?.uid === userId;

    return (
        <div className="text-sm leading-snug flex items-start justify-between group">
            <div>
                <Link
                    href={`/profile?id=${userId}`}
                    className="font-semibold hover:underline mr-2"
                >
                    {userProfile?.name || '...'}
                </Link>
                <span>{content}</span>
            </div>
            {isAuthor && commentId && (
                <button
                    onClick={handleDelete}
                    className="text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    title="Delete comment"
                >
                    <Trash2 className="h-3 w-3" />
                </button>
            )}
        </div>
    );
}

function InlineComments({ postId }: { postId: string }) {
    const firestore = useFirestore();
    const { user } = useUser();
    const [comment, setComment] = useState("");

    // Get latest 2 comments
    const commentsQuery = useMemoFirebase(
        () =>
            firestore
                ? query(
                    collection(firestore, 'posts', postId, 'comments'),
                    orderBy('createdAt', 'desc'),
                )
                : null,
        [firestore, postId]
    );
    const { data: comments } = useCollection(commentsQuery);

    // Logic to show only 2
    const displayComments = comments ? comments.slice(0, 2).reverse() : [];

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!comment.trim() || !user || !firestore) return;

        const postRef = doc(firestore, 'posts', postId);
        const commentsRef = collection(postRef, 'comments');

        await addDocumentNonBlocking(commentsRef, {
            userId: user.uid,
            content: comment,
            createdAt: serverTimestamp(),
        });

        updateDocumentNonBlocking(postRef, {
            commentCount: increment(1)
        });
        setComment("");
    }

    return (
        <div className="space-y-1 mt-2">
            {/* View all comments logic could go here */}
            {comments && comments.length > 2 && (
                <button className="text-muted-foreground text-sm mb-1 hover:text-foreground">
                    View all {comments.length} comments
                </button>
            )}

            {displayComments.map((c: any) => (
                <CommentAuthor
                    key={c.id}
                    userId={c.userId}
                    content={c.content}
                    postId={postId}
                    commentId={c.id}
                />
            ))}

            <form onSubmit={handleAddComment} className="flex items-center gap-2 mt-2 border-t pt-2 border-border/40">
                <Input
                    placeholder="Add a comment..."
                    className="border-none shadow-none h-8 px-0 focus-visible:ring-0 text-sm bg-transparent placeholder:text-muted-foreground/70"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                />
                {comment.trim() && (
                    <button type="submit" className="text-primary font-semibold text-sm hover:text-primary/80 transition-colors">Post</button>
                )}
            </form>
        </div>
    )
}

export function InstaPost({ post }: { post: Post }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const [isDeleting, setIsDeleting] = useState(false);

    // Optimistic Like State
    const [optimisticLiked, setOptimisticLiked] = useState(false);
    const [optimisticCount, setOptimisticCount] = useState(post.likeCount);
    const [hasLikedLoaded, setHasLikedLoaded] = useState(false);

    // Firestore Like Check
    const likeRef = useMemoFirebase(
        () =>
            user && firestore
                ? doc(firestore, "posts", post.id, "likes", user.uid)
                : null,
        [firestore, user, post.id]
    );

    // We use useDoc to sync initial state, but then we take over optimistically
    useDoc(likeRef, {
        onSnapshot: (snap) => {
            if (!hasLikedLoaded) {
                setOptimisticLiked(snap.exists());
                setHasLikedLoaded(true);
            }
        }
    });

    const handleLike = async () => {
        if (!user || !firestore) return;

        // Optimistic Update
        const isCurrentlyLiked = optimisticLiked;
        setOptimisticLiked(!isCurrentlyLiked);
        setOptimisticCount(prev => isCurrentlyLiked ? prev - 1 : prev + 1);

        // Background Sync
        const postRef = doc(firestore, "posts", post.id);
        const userLikeRef = doc(firestore, "posts", post.id, "likes", user.uid);

        try {
            await runTransaction(firestore, async (transaction) => {
                const likeDoc = await transaction.get(userLikeRef);
                if (likeDoc.exists()) {
                    if (!isCurrentlyLiked) return; // Already unlike (ui state mismatch fix)
                    transaction.delete(userLikeRef);
                    transaction.update(postRef, { likeCount: increment(-1) });
                } else {
                    if (isCurrentlyLiked) return; // Already liked
                    transaction.set(userLikeRef, { userId: user.uid });
                    transaction.update(postRef, { likeCount: increment(1) });
                }
            });
        } catch (error) {
            console.error("Like transaction failed", error);
            // Revert on failure
            setOptimisticLiked(isCurrentlyLiked);
            setOptimisticCount(prev => isCurrentlyLiked ? prev + 1 : prev - 1);
        }
    };

    const handleDelete = async () => {
        if (!user || user.uid !== post.userId || !firestore) return;
        setIsDeleting(true);

        const postRef = doc(firestore, "posts", post.id);

        try {
            const batch = writeBatch(firestore);

            // Delete comments subcollection (simplified: assumes <500 comments for batch limit, real app needs recursion)
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

        } catch (e) {
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
        <div className="bg-card border rounded-xl overflow-hidden mb-8 shadow-sm hover:shadow-md transition-shadow">
            <PostHeader userId={post.userId} ownerId={post.userId} postId={post.id} onDelete={handleDelete} />

            {/* Media or Text Content */}
            <div
                className="relative w-full overflow-hidden bg-muted/20 flex items-center justify-center min-h-[300px] border-y border-border/40"
                onDoubleClick={handleLike}
            >
                {post.imageUrl ? (
                    <Image
                        src={post.imageUrl}
                        alt="Post content"
                        width={0}
                        height={0}
                        sizes="100vw"
                        style={{ width: '100%', height: 'auto' }}
                        className="object-contain max-h-[600px] w-full"
                    />
                ) : (
                    <div className="p-8 text-center flex flex-col items-center justify-center h-full w-full min-h-[300px] bg-gradient-to-br from-primary/5 via-violet-500/5 to-cyan-500/5">
                        <p className="text-xl font-medium text-foreground/90 whitespace-pre-wrap leading-relaxed max-w-md">{post.content}</p>
                    </div>
                )}
            </div>

            {/* Action Bar */}
            <div className="p-3 pb-1">
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-4">
                        <button onClick={handleLike} className="group focus:outline-none transition-transform active:scale-90">
                            <Heart
                                className={`h-7 w-7 transition-all ${optimisticLiked ? 'fill-red-500 text-red-500 scale-110' : 'text-foreground hover:text-muted-foreground'}`}
                            />
                        </button>
                        <button className="focus:outline-none transition-transform active:scale-90">
                            <MessageCircle className="h-7 w-7 text-foreground hover:text-muted-foreground -rotate-4" />
                        </button>
                        <button className="focus:outline-none transition-transform active:scale-90">
                            <Send className="h-7 w-7 text-foreground hover:text-muted-foreground -rotate-12" />
                        </button>
                    </div>
                    <button className="focus:outline-none transition-transform active:scale-90">
                        <Bookmark className="h-7 w-7 text-foreground hover:text-muted-foreground" />
                    </button>
                </div>

                {/* Likes */}
                <div className="font-semibold text-sm mb-2">
                    {optimisticCount} likes
                </div>

                {/* Caption */}
                {post.imageUrl && post.content && (
                    <div className="mb-1">
                        <CommentAuthor userId={post.userId} content={post.content} />
                    </div>
                )}
                {!post.imageUrl && (
                    <div className="text-xs text-muted-foreground mb-2 px-1">
                        Posted {timeAgo}
                    </div>
                )}

                {/* Comments */}
                <InlineComments postId={post.id} />

                {post.imageUrl && <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-3 mb-1">{timeAgo}</div>}
            </div>
        </div>
    );
}
