"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Sparkles, Wand2 } from "lucide-react";

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
import { getRecommendationsAction } from "./actions";
import type { RecommendationState } from "./actions";

const formSchema = z.object({
  language: z.string({ required_error: "Please select a language." }),
  curriculum: z.string().min(3, "Curriculum is required."),
  learningGaps: z.string().min(10, "Please describe your learning gaps."),
});

const initialState: RecommendationState = {
  form: {
    language: "English",
    curriculum: "",
    learningGaps: "",
  },
  status: "idle",
  message: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Wand2 className="mr-2 h-4 w-4" />
      )}
      Generate Recommendations
    </Button>
  );
}

export default function RecommendationsPage() {
  const [state, formAction] = useActionState(getRecommendationsAction, initialState);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      language: "English",
      curriculum: "",
      learningGaps: "",
    },
  });

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
            <form action={formAction} className="space-y-6">
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <SubmitButton />
              </CardFooter>
            </form>
          </Form>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="font-headline">Your Recommended Resources</CardTitle>
            <CardDescription>
              Here are some resources tailored just for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {state.status === "loading" && (
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}
            {state.status === 'idle' && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Sparkles className="h-12 w-12 mb-4" />
                  <p className="text-lg">Your recommendations will appear here.</p>
                  <p>Fill out the form to get started.</p>
              </div>
            )}
             {state.status === 'error' && state.message && (
              <div className="flex items-center justify-center h-full text-destructive">
                <p>{state.message}</p>
              </div>
            )}
            {state.status === 'success' && state.recommendations && (
              <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                {state.recommendations}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
