'use server';

/**
 * @fileOverview A flow for recommending relevant learning resources based on a student's language,
 * curriculum, and identified learning gaps.
 *
 * - recommendRelevantResources - A function that recommends learning resources.
 * - RecommendRelevantResourcesInput - The input type for the recommendRelevantResources function.
 * - RecommendRelevantResourcesOutput - The return type for the recommendRelevantResources function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const RecommendRelevantResourcesInputSchema = z.object({
  language: z
    .string()
    .describe('The student`s native language.'),
  curriculum: z.string().describe('The student`s curriculum.'),
  learningGaps: z
    .string()
    .describe('The identified learning gaps of the student.'),
});
export type RecommendRelevantResourcesInput = z.infer<
  typeof RecommendRelevantResourcesInputSchema
>;

const RecommendRelevantResourcesOutputSchema = z.object({
  resourceRecommendations: z
    .string()
    .describe(
      'A list of recommended learning resources tailored to the student`s needs.'
    ),
});
export type RecommendRelevantResourcesOutput = z.infer<
  typeof RecommendRelevantResourcesOutputSchema
>;

export async function recommendRelevantResources(
  input: RecommendRelevantResourcesInput
): Promise<RecommendRelevantResourcesOutput> {
  return recommendRelevantResourcesFlow(input);
}


const recommendRelevantResourcesFlow = ai.defineFlow(
  {
    name: 'recommendRelevantResourcesFlow',
    inputSchema: RecommendRelevantResourcesInputSchema,
    outputSchema: RecommendRelevantResourcesOutputSchema,
  },
  async (input) => {
    const { text } = await ai.generate({
      model: 'vertexai/gemini-2.0-flash-exp',
      prompt: `You are an expert in recommending educational resources to students.
        
        Based on the student's native language, curriculum, and identified learning gaps, recommend a list of relevant learning resources.
        
        Language: ${input.language}
        Curriculum: ${input.curriculum}
        Learning Gaps: ${input.learningGaps}
        
        Provide a detailed and helpful list of resources in Markdown format.
        Do not output JSON. Just output the content directly.`,
    });

    if (!text) {
      throw new Error('Failed to generate recommendations');
    }

    return {
      resourceRecommendations: text
    };
  }
);
