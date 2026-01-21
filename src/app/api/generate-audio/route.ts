import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { getGoogleCredentials } from '@/lib/google-auth';

// Allow this function to run for up to 60 seconds (Vercel Limit)
export const maxDuration = 60;

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

export async function POST(req: NextRequest) {
    try {
        const { text, language } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 });
        }

        // Initialize Google Cloud TTS Client
        const credentials = getGoogleCredentials();
        const ttsClient = new TextToSpeechClient(credentials ? { credentials } : {});

        // Truncate text if too long to prevent timeouts/errors (Google TTS limit is ~5000 bytes)
        let processedText = text;
        if (text.length > 4000) {
            console.warn(`Text too long (${text.length} chars), truncating to 4000 chars to avoid timeout.`);
            processedText = text.substring(0, 4000);
        }

        const voiceConfig = getVoiceConfig(language);
        console.log(`Generating Audio for ${language || 'default'} using voice: ${voiceConfig.name}. Text length: ${processedText.length}`);

        const request = {
            input: { text: processedText },
            voice: {
                languageCode: voiceConfig.languageCode,
                name: voiceConfig.name
            },
            audioConfig: { audioEncoding: 'MP3' as const },
        };

        const [response] = await ttsClient.synthesizeSpeech(request);
        const audioContent = response.audioContent;

        if (!audioContent) {
            throw new Error('Failed to generate audio content.');
        }

        const audioBase64 = Buffer.from(audioContent).toString('base64');
        const audioDataUri = `data:audio/mp3;base64,${audioBase64}`;

        return NextResponse.json({ audioDataUri });

    } catch (error: any) {
        console.error('Audio generation error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate audio' },
            { status: 500 }
        );
    }
}
