'use server';

/**
 * @fileOverview A flow that answers STEM questions in the student's native language, supporting both text and speech input.
 * This flow includes caching to reduce AI model usage and improve response times for repeated questions.
 *
 * - answerVernacularQuestion - A function that accepts a question in the student's native language and returns an answer or guidance.
 * - AnswerVernacularQuestionInput - The input type for the answerVernacularQuestion function.
 * - AnswerVernacularQuestionOutput - The return type for the answerVernacularQuestion function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as admin from 'firebase-admin';

import { getGoogleCredentials } from '@/lib/google-auth';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    const credentials = getGoogleCredentials();
    admin.initializeApp({
      credential: credentials ? admin.credential.cert(credentials) : undefined
    });
  } catch (e) {
    console.error('Firebase admin initialization error', e);
  }
}

const db = admin.firestore();


const AnswerVernacularQuestionInputSchema = z.object({
  question: z
    .string()
    .describe('The question asked by the student in their native language.'),
  language: z.string().describe('The native language of the student.'),
});
export type AnswerVernacularQuestionInput = z.infer<
  typeof AnswerVernacularQuestionInputSchema
>;

const AnswerVernacularQuestionOutputSchema = z.object({
  answer: z
    .string()
    .describe('The answer to the question in the student\'s native language.'),
});
export type AnswerVernacularQuestionOutput = z.infer<
  typeof AnswerVernacularQuestionOutputSchema
>;

export async function answerVernacularQuestion(
  input: AnswerVernacularQuestionInput
): Promise<AnswerVernacularQuestionOutput> {
  return answerVernacularQuestionFlow(input);
}

const answerVernacularQuestionPrompt = ai.definePrompt({
  name: 'answerVernacularQuestionPrompt',
  input: { schema: AnswerVernacularQuestionInputSchema },
  output: { schema: AnswerVernacularQuestionOutputSchema },
  model: 'vertexai/gemini-2.0-flash-exp',
  prompt: `You are a helpful STEM tutor. A student will ask a question in their native language, and you will respond with an answer or guidance in the same language.

  Language: {{{language}}}
  Question: {{{question}}}
  `,
});

const answerVernacularQuestionFlow = ai.defineFlow(
  {
    name: 'answerVernacularQuestionFlow',
    inputSchema: AnswerVernacularQuestionInputSchema,
    outputSchema: AnswerVernacularQuestionOutputSchema,
  },
  async ({ question, language }) => {
    // 1. Check cache first
    try {
      const cacheRef = db.collection('cachedQuestions');
      const q = cacheRef.where('question', '==', question).where('language', '==', language).limit(1);
      const snapshot = await q.get();

      if (!snapshot.empty) {
        const cachedData = snapshot.docs[0].data();
        return { answer: cachedData.answer };
      }
    } catch (error) {
      console.error("Error checking cache:", error);
      // Don't block, just log and proceed to AI
    }

    // 2. If not in cache, call the AI
    const { output } = await answerVernacularQuestionPrompt({ question, language });

    if (!output?.answer) {
      throw new Error('Failed to get an answer from the AI.');
    }
    const answer = output.answer;

    // 3. Save to cache (don't await, let it run in the background)
    try {
      const cacheRef = db.collection('cachedQuestions');
      cacheRef.add({
        question,
        language,
        answer,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error("Error saving to cache:", error);
      // Don't block, just log
    }

    return { answer };
  }
);
