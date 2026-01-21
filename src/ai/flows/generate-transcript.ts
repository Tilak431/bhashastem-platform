'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateTranscriptInputSchema = z.object({
    fileUrl: z.string().describe('The URL of the video/audio file.'),
    targetLanguage: z.string().describe('The language to transcribe/translate into.'),
});

export type GenerateTranscriptInput = z.infer<typeof GenerateTranscriptInputSchema>;

const GenerateTranscriptOutputSchema = z.object({
    transcript: z.string().describe('The generated transcript in the target language.'),
});

export type GenerateTranscriptOutput = z.infer<typeof GenerateTranscriptOutputSchema>;

const generateTranscriptFlow = ai.defineFlow(
    {
        name: 'generateTranscriptFlow',
        inputSchema: GenerateTranscriptInputSchema,
        outputSchema: GenerateTranscriptOutputSchema,
    },
    async ({ fileUrl, targetLanguage }) => {
        // We use the multimodal model to process the video directly
        const { text } = await ai.generate({
            model: 'vertexai/gemini-2.0-flash-exp',
            prompt: [
                { media: { url: fileUrl } },
                {
                    text: `You are an expert transcriber and translator. 
please transcribe the speech from this video and translate it directly into ${targetLanguage}.
Provide ONLY the translated transcript text. Do not include timestamps or user names unless they are essential.
The output should be the continuous text of the speech in ${targetLanguage}.`
                }
            ],
            config: {
                temperature: 0.3,
            }
        });

        if (!text) {
            throw new Error('Failed to generate transcript.');
        }

        return {
            transcript: text,
        };
    }
);

export async function generateTranscript(
    input: GenerateTranscriptInput
): Promise<GenerateTranscriptOutput> {
    return generateTranscriptFlow(input);
}
