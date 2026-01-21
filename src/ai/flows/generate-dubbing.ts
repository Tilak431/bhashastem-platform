'use server';
export const maxDuration = 60; // Set timeout to 60 seconds (max for Vercel Hobby)
/**
 * @fileOverview A flow that translates full text and generates audio for the translation (dubbing).
 *
 * - generateDubbing - A function that handles the entire process.
 * - GenerateDubbingInput - The input type for the function.
 * - GenerateDubbingOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import wav from 'wav';

const GenerateDubbingInputSchema = z.object({
  text: z.string().describe('The full transcript/text to translate and dub.'),
  targetLanguage: z.string().describe('The language for the output.'),
});
export type GenerateDubbingInput = z.infer<typeof GenerateDubbingInputSchema>;

const GenerateDubbingOutputSchema = z.object({
  translatedText: z.string().describe('The full translated text.'),
  audioDataUri: z.string().describe('The audio of the translation as a base64 data URI.'),
});
export type GenerateDubbingOutput = z.infer<typeof GenerateDubbingOutputSchema>;


const dubbingTranslationPrompt = ai.definePrompt({
  name: 'dubbingTranslationPrompt',
  input: { schema: z.object({ text: z.string(), targetLanguage: z.string() }) },
  output: { schema: z.object({ translatedText: z.string() }) },
  prompt: `You are an expert professional translator. Your task is to translate the provided transcript into {{{targetLanguage}}}.
    
The translation must be:
1.  **Accurate**: Convey the exact meaning of the original text.
2.  **Natural**: Sound like a native speaker of the target language.
3.  **Complete**: Do not summarize. Translate the *entire* text provided.

Transcript:
{{{text}}}

Respond with a JSON object with a single key "translatedText" containing the full translated text. Your final output should ONLY be this JSON object.`,
});

async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}


// Initialize Google Cloud TTS Client
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { getGoogleCredentials } from '@/lib/google-auth';

const credentials = getGoogleCredentials();
const ttsClient = new TextToSpeechClient(credentials ? { credentials } : {});

// Helper to map language names to specific Google Cloud TTS voice names
// Using Neural2 and Wavenet for higher quality and better accents
const getVoiceConfig = (language: string) => {
  const normalize = (s: string) => s.toLowerCase().trim();
  const lang = normalize(language);

  if (lang.includes('hindi') || lang === 'hi') {
    return { languageCode: 'hi-IN', name: 'hi-IN-Neural2-A' }; // Female, high quality
  }
  if (lang.includes('tamil') || lang === 'ta') {
    return { languageCode: 'ta-IN', name: 'ta-IN-Wavenet-B' }; // Female
  }
  if (lang.includes('bengali') || lang === 'bn') {
    return { languageCode: 'bn-IN', name: 'bn-IN-Wavenet-A' }; // Female
  }
  if (lang.includes('kannada') || lang === 'kn') {
    return { languageCode: 'kn-IN', name: 'kn-IN-Wavenet-A' }; // Female
  }
  if (lang.includes('telugu') || lang === 'te') {
    return { languageCode: 'te-IN', name: 'te-IN-Standard-A' }; // Female
  }
  if (lang.includes('english') || lang === 'en') {
    return { languageCode: 'en-IN', name: 'en-IN-Neural2-A' }; // Indian English
  }

  // Default to US English
  return { languageCode: 'en-US', name: 'en-US-Neural2-F' };
};


const generateDubbingFlow = ai.defineFlow(
  {
    name: 'generateDubbingFlow',
    inputSchema: GenerateDubbingInputSchema,
    outputSchema: GenerateDubbingOutputSchema,
  },
  async ({ text, targetLanguage }) => {
    // Step 1: Translate Full Text
    const { output: translationOutput } = await dubbingTranslationPrompt({ text, targetLanguage });
    if (!translationOutput?.translatedText) {
      throw new Error('Failed to generate translated text.');
    }
    const translatedText = translationOutput.translatedText;

    // Step 2: Text-to-Speech (Standard Google Cloud TTS)
    const voiceConfig = getVoiceConfig(targetLanguage);
    console.log(`Generating Audio for ${targetLanguage} using voice: ${voiceConfig.name}`); // Debug log

    const request = {
      input: { text: translatedText },
      // Select the language and specific voice name for better accent
      voice: {
        languageCode: voiceConfig.languageCode,
        name: voiceConfig.name
      },
      // select the type of audio encoding
      audioConfig: { audioEncoding: 'LINEAR16' as const },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    const audioContent = response.audioContent;

    if (!audioContent) {
      throw new Error('Failed to generate audio content.');
    }

    const audioBase64 = Buffer.from(audioContent).toString('base64');
    const audioDataUri = `data:audio/wav;base64,${audioBase64}`;

    // Step 3: Return both text and audio
    return {
      translatedText,
      audioDataUri,
    };
  }
);



export async function generateDubbing(
  input: GenerateDubbingInput
): Promise<GenerateDubbingOutput> {
  return generateDubbingFlow(input);
}
