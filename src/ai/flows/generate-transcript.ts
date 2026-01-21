'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateTranscriptInputSchema = z.object({
    fileUrl: z.string().describe('The URL of the video/audio file.'),
    targetLanguage: z.string().describe('The language to transcribe/translate into.'),
});

export type GenerateTranscriptInput = z.infer<typeof GenerateTranscriptInputSchema>;

const GenerateTranscriptOutputSchema = z.object({
    segments: z.array(z.object({
        start: z.string().describe('Start time of the segment in "MM:SS" format'),
        end: z.string().describe('End time of the segment in "MM:SS" format'),
        text: z.string().describe('The translated text for this segment'),
    })).describe('List of translated speech segments with timestamps'),
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
        const { output } = await ai.generate({
            model: 'vertexai/gemini-2.0-flash-exp',
            output: { schema: GenerateTranscriptOutputSchema },
            prompt: [
                { media: { url: fileUrl } },
                {
                    text: `You are an expert transcriber and translator. 
please transcribe the speech from this video and translate it directly into ${targetLanguage}.
Divide the speech into logical sentence-level segments.
For each segment, provide:
1. "start": The start timestamp in MM:SS format (e.g., "00:05").
2. "end": The end timestamp in MM:SS format (e.g., "00:12").
3. "text": The translated text in ${targetLanguage}.

Return ONLY the JSON object matching the schema.`
                }
            ],
            config: {
                temperature: 0.3,
            }
        });

        if (!output) {
            throw new Error('Failed to generate transcript.');
        }

        return output;
    }
);

export async function generateTranscript(
    input: GenerateTranscriptInput
): Promise<GenerateTranscriptOutput> {
    return generateTranscriptFlow(input);
}
