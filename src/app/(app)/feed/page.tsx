'use client';

import {
  addDocumentNonBlocking,
  useCollection,
  useFirestore,
  useMemoFirebase,
  useUser,
} from '@/firebase';
import {
  collection,
  query,
  orderBy,
  serverTimestamp,
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
import {
  Loader2,
  Paperclip,
  X,
} from 'lucide-react';
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
import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import Image from 'next/image';

import { InstaPost, Post } from '@/components/feed/insta-post';

const createPostSchema = z.object({
  content: z.string().max(280),
});

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
    if (fileInputRef.current) {
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
    await addDocumentNonBlocking(postsRef, {
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
    <Card className="border-none shadow-sm mb-8 bg-card/50 backdrop-blur-sm">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-headline bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent w-fit">Create Post</CardTitle>
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
                      className="min-h-[100px] resize-none border-0 focus-visible:ring-0 bg-secondary/30 rounded-xl px-4 py-3 placeholder:text-muted-foreground/60 text-base"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {imagePreview && (
              <div className="relative w-full">
                <Image src={imagePreview} alt="Image preview" width={0} height={0} sizes="100vw" style={{ width: '100%', height: 'auto' }} className="rounded-xl object-contain bg-black/5 border" />
                <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-lg" onClick={removeImage}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between pt-0">
            <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full h-10 w-10" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-5 w-5" />
              <span className="sr-only">Attach image</span>
            </Button>
            <Input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/jpg" />
            <Button type="submit" disabled={isSubmitting} className="rounded-full px-6 font-semibold bg-primary hover:bg-primary/90">
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
    <div className="flex-1 w-full min-h-screen bg-transparent">
      <div className="max-w-xl mx-auto py-8 px-4 md:px-0">

        {/* Create Post Section */}
        <CreatePost />

        {/* Feed Stream */}
        <div className="space-y-2">
          {isLoading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {posts?.map(post => (
            <InstaPost key={post.id} post={post} />
          ))}

          {!isLoading && posts?.length === 0 && (
            <Card className="text-center p-12 border-dashed bg-transparent">
              <div className="flex flex-col items-center gap-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <Paperclip className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">No posts yet</h3>
                <p className="text-muted-foreground">
                  Be the first to share something with the community!
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
