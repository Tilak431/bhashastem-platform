"use server";

import { z } from "zod";
import { recommendRelevantResources } from "@/ai/flows/recommend-relevant-resources";

const RecommendationSchema = z.object({
  language: z.string(),
  curriculum: z.string().min(3, "Curriculum must be at least 3 characters."),
  learningGaps: z.string().min(10, "Please describe learning gaps in at least 10 characters."),
});

export type RecommendationState = {
  form: {
    language: string;
    curriculum: string;
    learningGaps: string;
  };
  status: "idle" | "loading" | "success" | "error";
  message: string;
  recommendations?: string;
};

export async function getRecommendationsAction(
  prevState: RecommendationState,
  formData: FormData
): Promise<RecommendationState> {
  const validatedFields = RecommendationSchema.safeParse({
    language: formData.get("language"),
    curriculum: formData.get("curriculum"),
    learningGaps: formData.get("learningGaps"),
  });
  
  if (!validatedFields.success) {
    const errorMessages = validatedFields.error.errors.map(e => e.message).join('\n');
    return {
      ...prevState,
      status: "error",
      message: errorMessages || "Invalid input. Please check your entries.",
    };
  }

  const { language, curriculum, learningGaps } = validatedFields.data;

  try {
    const result = await recommendRelevantResources({
      language,
      curriculum,
      learningGaps,
    });
    return {
      ...prevState,
      status: "success",
      message: "Recommendations received.",
      recommendations: result.resourceRecommendations,
    };
  } catch (error) {
    console.error(error);
    return {
      ...prevState,
      status: "error",
      message: "An error occurred while getting recommendations. Please try again.",
    };
  }
}
