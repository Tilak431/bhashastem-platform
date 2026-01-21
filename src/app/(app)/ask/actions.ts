"use server";

import { z } from "zod";
import { answerVernacularQuestion } from "@/ai/flows/answer-vernacular-questions";

const AskQuestionSchema = z.object({
  question: z.string().min(5, "Question must be at least 5 characters long."),
  language: z.string(),
});

export type AskQuestionState = {
  form: {
    question: string;
    language: string;
  };
  status: "idle" | "loading" | "success" | "error";
  message: string;
  answer?: string;
};

export async function askQuestionAction(
  prevState: AskQuestionState,
  formData: FormData
): Promise<AskQuestionState> {
  const validatedFields = AskQuestionSchema.safeParse({
    question: formData.get("question"),
    language: formData.get("language"),
  });

  if (!validatedFields.success) {
    return {
      ...prevState,
      status: "error",
      message: "Invalid input. Please check your question.",
    };
  }

  const { question, language } = validatedFields.data;

  try {
    const result = await answerVernacularQuestion({
      question,
      language,
    });
    return {
      ...prevState,
      status: "success",
      message: "Answer received.",
      answer: result.answer,
    };
  } catch (error) {
    console.error(error);
    return {
      ...prevState,
      status: "error",
      message: "An error occurred while getting the answer. Please try again.",
    };
  }
}
