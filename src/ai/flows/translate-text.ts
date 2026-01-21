'use server';

/**
 * @fileOverview A flow that translates a question and its answers from English to a specified target language in a single call.
 *
 * - translateText - A function that translates text.
 * - TranslateTextInput - The input type for the translateText function.
 * - TranslateTextOutput - The return type for the translateText function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const TranslateTextInputSchema = z.object({
  question: z.string().describe('The English text of the question to translate.'),
  answers: z.array(z.object({
    id: z.string(),
    text: z.string()
  })).describe('An array of answer objects to translate.'),
  targetLanguage: z.string().describe('The language to translate the text into.'),
});
export type TranslateTextInput = z.infer<typeof TranslateTextInputSchema>;

const TranslateTextOutputSchema = z.object({
  translatedQuestion: z.string().describe('The translated question text.'),
  translatedAnswers: z.array(z.object({
    id: z.string(),
    text: z.string()
  })).describe('An array of translated answer objects.'),
});
export type TranslateTextOutput = z.infer<typeof TranslateTextOutputSchema>;

export async function translateText(
  input: TranslateTextInput
): Promise<TranslateTextOutput> {
  return translateTextFlow(input);
}

const translateTextPrompt = ai.definePrompt({
  name: 'translateTextPrompt',
  input: { schema: TranslateTextInputSchema },
  output: { schema: TranslateTextOutputSchema },
  prompt: `You are a translation expert specializing in STEM terminology. Translate the following JSON object containing a question and its answers from English to {{{targetLanguage}}}.

Respond with a JSON object in the same format, containing the translated text. Return ONLY the JSON object.

Text to translate:
{
  "question": "{{{question}}}",
  "answers": [
    {{#each answers}}
    { "id": "{{this.id}}", "text": "{{this.text}}" }{{#unless @last}},{{/unless}}
    {{/each}}
  ]
}
`,
});

const translateTextFlow = ai.defineFlow(
  {
    name: 'translateTextFlow',
    inputSchema: TranslateTextInputSchema,
    outputSchema: TranslateTextOutputSchema,
  },
  async (input) => {
    const {output} = await translateTextPrompt(input);
    return output!;
  }
);
