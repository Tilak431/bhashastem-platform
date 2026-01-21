'use server';
/**
 * @fileOverview A flow that summarizes text, translates it, and generates audio for the translation.
 *
 * - summarizeAndSpeak - A function that handles the entire process.
 * - SummarizeTextInput - The input type for the function.
 * - SummarizeAndSpeakOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import wav from 'wav';

const SummarizeTextInputSchema = z.object({
  text: z.string().describe('The text to summarize and translate.'),
  targetLanguage: z.string().describe('The language for the output.'),
});
export type SummarizeTextInput = z.infer<typeof SummarizeTextInputSchema>;

const SummarizeAndSpeakOutputSchema = z.object({
  summary: z.string().describe('The generated text summary.'),
  audioDataUri: z.string().describe('The audio of the summary as a base64 data URI.'),
});
export type SummarizeAndSpeakOutput = z.infer<typeof SummarizeAndSpeakOutputSchema>;


const summarizeAndTranslatePrompt = ai.definePrompt({
  name: 'summarizeAndTranslatePrompt',
  input: { schema: z.object({ text: z.string(), targetLanguage: z.string() }) },
  output: { schema: z.object({ translatedSummary: z.string() }) },
  prompt: `You are an expert educator creating a detailed audio summary of a lesson. Based on the provided transcript, create a comprehensive summary that captures all the main concepts, key explanations, and important examples. The summary should be thorough enough to produce an audio summary of approximately 1 minute and 30 seconds, giving a listener a deep understanding of the material as if they were listening to a condensed version of the original lecture.

After creating this detailed summary, translate it into {{{targetLanguage}}}.

Transcript:
{{{text}}}

Respond with a JSON object with a single key "translatedSummary" containing the translated summary. Your final output should ONLY be this JSON object.`,
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

const summarizeAndSpeakFlow = ai.defineFlow(
  {
    name: 'summarizeAndSpeakFlow',
    inputSchema: SummarizeTextInputSchema,
    outputSchema: SummarizeAndSpeakOutputSchema,
  },
  async ({ text, targetLanguage }) => {
    // Step 1: Summarize and Translate
    const { output: translationOutput } = await summarizeAndTranslatePrompt({ text, targetLanguage });
    if (!translationOutput?.translatedSummary) {
      throw new Error('Failed to generate translated summary.');
    }
    const summary = translationOutput.translatedSummary;

    // Step 2: Text-to-Speech (Standard Google Cloud TTS)
    const request = {
      input: { text: summary },
      // Select the language and SSML voice gender (optional)
      voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' as const },
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
      summary,
      audioDataUri,
    };
  }
);



export async function summarizeAndSpeak(
  input: SummarizeTextInput
): Promise<SummarizeAndSpeakOutput> {
  return summarizeAndSpeakFlow(input);
}

