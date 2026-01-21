'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

const GenerateAudioInputSchema = z.object({
    text: z.string().describe('The text to convert to speech.'),
    language: z.string().describe('The language for the audio accent.').optional(),
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

// Helper to map language names to specific Google Cloud TTS voice names
const getVoiceConfig = (language?: string) => {
    if (!language) return { languageCode: 'en-US', name: 'en-US-Neural2-F' };

    const normalize = (s: string) => s.toLowerCase().trim();
    const lang = normalize(language);

    if (lang.includes('hindi') || lang === 'hi') {
        return { languageCode: 'hi-IN', name: 'hi-IN-Neural2-A' };
    }
    if (lang.includes('tamil') || lang === 'ta') {
        return { languageCode: 'ta-IN', name: 'ta-IN-Wavenet-B' };
    }
    if (lang.includes('bengali') || lang === 'bn') {
        return { languageCode: 'bn-IN', name: 'bn-IN-Wavenet-A' };
    }
    if (lang.includes('kannada') || lang === 'kn') {
        return { languageCode: 'kn-IN', name: 'kn-IN-Wavenet-A' };
    }
    if (lang.includes('telugu') || lang === 'te') {
        return { languageCode: 'te-IN', name: 'te-IN-Standard-A' };
    }
    if (lang.includes('english') || lang === 'en') {
        return { languageCode: 'en-IN', name: 'en-IN-Neural2-A' };
    }

    // Default to US English
    return { languageCode: 'en-US', name: 'en-US-Neural2-F' };
};

const generateAudioFlow = ai.defineFlow(
    {
        name: 'generateAudioFlow',
        inputSchema: GenerateAudioInputSchema,
        outputSchema: GenerateAudioOutputSchema,
    },
    async ({ text, language }) => {
        const voiceConfig = getVoiceConfig(language);
        console.log(`Generating Audio for ${language || 'default'} using voice: ${voiceConfig.name}`);

        // Construct the request
        const request = {
            input: { text: text },
            // Select the language and specific voice name
            voice: {
                languageCode: voiceConfig.languageCode,
                name: voiceConfig.name
            },
            // select the type of audio encoding
            audioConfig: { audioEncoding: 'LINEAR16' as const },
        };

        // Performs the text-to-speech request
        const [response] = await ttsClient.synthesizeSpeech(request);
        const audioContent = response.audioContent;

        if (!audioContent) {
            throw new Error('Failed to generate audio content.');
        }

        // Convert the audio content to a base64 data URI
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

