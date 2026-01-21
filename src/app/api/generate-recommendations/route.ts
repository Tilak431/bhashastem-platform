import { NextRequest, NextResponse } from 'next/server';
import { recommendRelevantResources } from '@/ai/flows/recommend-relevant-resources';
import { z } from 'zod';

// Allow this function to run for up to 60 seconds (Vercel Hobby Limit)
export const maxDuration = 60;

const RecommendationSchema = z.object({
    language: z.string(),
    curriculum: z.string().min(3, "Curriculum must be at least 3 characters."),
    learningGaps: z.string().min(10, "Please describe learning gaps in at least 10 characters."),
});

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        if (retries > 0 && (error?.status === 429 || error?.code === 429 || error?.code === 'RESOURCE_EXHAUSTED' || error?.message?.includes('429'))) {
            console.log(`Rate limited. Retrying in ${delay}ms... (${retries} retries left)`);
            await wait(delay);
            return retryOperation(operation, retries - 1, delay * 2);
        }
        throw error;
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const validation = RecommendationSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.format() },
                { status: 400 }
            );
        }

        const { language, curriculum, learningGaps } = validation.data;

        const result = await retryOperation(() => recommendRelevantResources({
            language,
            curriculum,
            learningGaps,
        }));

        return NextResponse.json({
            recommendations: result.resourceRecommendations
        });

    } catch (error: any) {
        console.error('Recommendation generation error:', error);

        const isRateLimit = error?.status === 429 || error?.code === 429 || error?.code === 'RESOURCE_EXHAUSTED';
        const errorMessage = isRateLimit
            ? 'AI service is currently busy. Please try again in top a few moments.'
            : (error.message || 'Failed to generate recommendations');

        return NextResponse.json(
            { error: errorMessage },
            { status: isRateLimit ? 429 : 500 }
        );
    }
}
