'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useActionState } from 'react';
import { Bot, Send, User, Loader2, Sparkles } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { languages } from '@/lib/data';
import { askQuestionAction } from './actions';
import type { AskQuestionState } from './actions';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  question: z
    .string()
    .min(5, 'Please enter a question with at least 5 characters.'),
  language: z.string({ required_error: 'Please select a language.' }),
});

type ConversationEntry = {
  role: 'user' | 'assistant';
  content: string;
};

const initialState: AskQuestionState = {
  form: {
    question: '',
    language: 'English',
  },
  status: 'idle',
  message: '',
};

export default function AskPage() {
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [state, formAction] = useActionState(askQuestionAction, initialState);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: '',
      language: 'English',
    },
  });

  useEffect(() => {
    if (state.status === 'success' && state.answer) {
      setConversation(prev => [
        ...prev,
        { role: 'assistant', content: state.answer! },
      ]);
      form.reset({ question: '', language: form.getValues('language') });
    } else if (state.status === 'error') {
      // Optionally handle error display, e.g., with a toast
      console.error(state.message);
    }
  }, [state, form]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [conversation]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    setConversation(prev => [
      ...prev,
      { role: 'user', content: values.question },
    ]);
    const formData = new FormData();
    formData.append('question', values.question);
    formData.append('language', values.language);
    startTransition(() => {
      formAction(formData);
    });
  };

  const isLoading = state.status === 'loading' || isPending;

  return (
    <div className="flex-1 p-4 md:p-6">
      <Card className="flex flex-col h-[calc(100vh-8rem)]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold tracking-tight font-headline">
              Ask AI Tutor
            </h2>
          </div>
          <p className="text-muted-foreground">
            Get instant help with your STEM questions in your native language.
          </p>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="space-y-6 pr-4">
              {conversation.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Bot className="h-12 w-12 mb-4" />
                  <p className="text-lg">No questions asked yet.</p>
                  <p>Start by typing your question below.</p>
                </div>
              ) : (
                conversation.map((entry, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-start gap-4',
                      entry.role === 'user' && 'justify-end'
                    )}
                  >
                    {entry.role === 'assistant' && (
                      <Avatar>
                        <AvatarFallback>
                          <Bot />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        'max-w-[75%] rounded-lg p-3',
                        entry.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">
                        {entry.content}
                      </p>
                    </div>
                    {entry.role === 'user' && (
                      <Avatar>
                        <AvatarFallback>
                          <User />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex items-start gap-4">
                  <Avatar>
                    <AvatarFallback>
                      <Bot />
                    </AvatarFallback>
                  </Avatar>
                  <div className="rounded-lg p-3 bg-muted flex items-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="pt-4 border-t">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex w-full items-start gap-4"
            >
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Language" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {languages.map(lang => (
                          <SelectItem key={lang} value={lang}>
                            {lang}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="question"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Textarea
                        placeholder="Ask about anything from black holes to chemical bonds..."
                        className="min-h-[40px]"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" size="icon" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </Form>
        </CardFooter>
      </Card>
    </div>
  );
}
