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

        const result = await recommendRelevantResources({
            language,
            curriculum,
            learningGaps,
        });

        return NextResponse.json({
            recommendations: result.resourceRecommendations
        });

    } catch (error: any) {
        console.error('Recommendation generation error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate recommendations' },
            { status: 500 }
        );
    }
}
