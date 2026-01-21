'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

const GenerateAudioInputSchema = z.object({
    text: z.string().describe('The text to convert to speech.'),
});

export type GenerateAudioInput = z.infer<typeof GenerateAudioInputSchema>;

const GenerateAudioOutputSchema = z.object({
    audioDataUri: z.string().describe('The generated audio as a base64 data URI.'),
});

export type GenerateAudioOutput = z.infer<typeof GenerateAudioOutputSchema>;

import { getGoogleCredentials } from '@/lib/google-auth';

// Initialize Google Cloud TTS Client
const credentials = getGoogleCredentials();
const ttsClient = new TextToSpeechClient(credentials ? { credentials } : {});

const generateAudioFlow = ai.defineFlow(
    {
        name: 'generateAudioFlow',
        inputSchema: GenerateAudioInputSchema,
        outputSchema: GenerateAudioOutputSchema,
    },
    async ({ text }) => {
        // Construct the request
        const request = {
            input: { text: text },
            // Select the language and SSML voice gender (optional)
            voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' as const },
            // select the type of audio encoding
            audioConfig: { audioEncoding: 'LINEAR16' as const }, // WAV format essentially
        };

        // Performs the text-to-speech request
        const [response] = await ttsClient.synthesizeSpeech(request);
        const audioContent = response.audioContent;

        if (!audioContent) {
            throw new Error('Failed to generate audio content.');
        }

        // Convert the audio content to a base64 data URI
        // audioContent can be a string or Uint8Array.
        const audioBase64 = Buffer.from(audioContent).toString('base64');
        const audioDataUri = `data:audio/wav;base64,${audioBase64}`;

        return {
            audioDataUri,
        };
    }
);

export async function generateAudio(
    input: GenerateAudioInput
): Promise<GenerateAudioOutput> {
    return generateAudioFlow(input);
}

