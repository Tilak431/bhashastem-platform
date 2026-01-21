"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Sparkles, Wand2, BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { languages } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  language: z.string({ required_error: "Please select a language." }),
  curriculum: z.string().min(3, "Curriculum is required."),
  learningGaps: z.string().min(10, "Please describe your learning gaps."),
});

type FormValues = z.infer<typeof formSchema>;

export default function RecommendationsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      language: "English",
      curriculum: "",
      learningGaps: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setError(null);
    setRecommendations(null);

    try {
      const response = await fetch('/api/generate-recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }

      const result = await response.json();
      setRecommendations(result.recommendations);

      toast({
        title: "Recommendations Generated",
        description: "We've created a personalized learning plan for you.",
      });
    } catch (err) {
      console.error(err);
      setError("An error occurred while getting recommendations. Please try again.");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not generate recommendations. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight font-headline">
          AI Recommendations
        </h2>
        <p className="text-muted-foreground">
          Let our AI find the perfect resources to fill your learning gaps.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <CardHeader>
                <CardTitle className="font-headline">Tell us what you need</CardTitle>
                <CardDescription>
                  Provide some details and we'll generate a personalized learning plan for you.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} name={field.name}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {languages.map((lang) => (
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
                  name="curriculum"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Curriculum</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., CBSE Class 12, ICSE Class 10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="learningGaps"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Learning Gaps</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., I struggle with thermodynamics in Physics and find it hard to visualize chemical reactions."
                          className="min-h-32"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  {isLoading ? 'Generating Plan...' : 'Generate Recommendations'}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>

        <Card className="flex flex-col min-h-[500px]">
          <CardHeader>
            <CardTitle className="font-headline">Your Recommended Resources</CardTitle>
            <CardDescription>
              Here are some resources tailored just for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {isLoading && (
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground animate-pulse">Analyzing your learning profile...</p>
              </div>
            )}
            {!isLoading && !recommendations && !error && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                <Sparkles className="h-12 w-12 mb-4 text-yellow-500/50" />
                <p className="text-lg font-medium">Ready to assist you!</p>
                <p className="text-sm">Fill out the form to get a personalized study plan.</p>
              </div>
            )}
            {!isLoading && error && (
              <div className="flex flex-col items-center justify-center h-full text-destructive p-8 text-center">
                <BookOpen className="h-12 w-12 mb-4 opacity-50" />
                <p className="font-medium">{error}</p>
                <Button variant="outline" className="mt-4" onClick={() => form.handleSubmit(onSubmit)()}>
                  Try Again
                </Button>
              </div>
            )}
            {!isLoading && recommendations && (
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground whitespace-pre-wrap bg-accent/10 p-4 rounded-lg border">
                {recommendations}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
