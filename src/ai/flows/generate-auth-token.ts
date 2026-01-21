
'use server';
/**
 * @fileOverview A flow for generating a custom Firebase authentication token.
 * This flow validates an access key and creates a token with appropriate custom claims
 * for role-based access control (teacher vs. student).
 *
 * - generateAuthToken - A function that handles the token generation process.
 * - GenerateAuthTokenInput - The input type for the generateAuthToken function.
 * - GenerateAuthTokenOutput - The return type for the generateAuthToken function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as admin from 'firebase-admin';

// In a real app, these would be stored securely (e.g., in a secret manager)
const TEACHER_KEY = 'teacher-secret-key';
const STUDENT_KEY = 'student-access-key';
const CLASS_SECTION_ID = 'IS-B'; // The class section this key system applies to

const GenerateAuthTokenInputSchema = z.object({
  accessKey: z.string().describe('The secret key provided by the user.'),
  uid: z.string().describe('A unique identifier for the user session.'),
});
export type GenerateAuthTokenInput = z.infer<
  typeof GenerateAuthTokenInputSchema
>;

const GenerateAuthTokenOutputSchema = z.object({
  customToken: z.string().describe('The Firebase custom authentication token.'),
  userType: z.enum(['teacher', 'student']).describe('The role of the user.'),
});
export type GenerateAuthTokenOutput = z.infer<
  typeof GenerateAuthTokenOutputSchema
>;

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

export async function generateAuthToken(
  input: GenerateAuthTokenInput
): Promise<GenerateAuthTokenOutput> {
  return generateAuthTokenFlow(input);
}

const generateAuthTokenFlow = ai.defineFlow(
  {
    name: 'generateAuthTokenFlow',
    inputSchema: GenerateAuthTokenInputSchema,
    outputSchema: GenerateAuthTokenOutputSchema,
  },
  async ({ accessKey, uid }) => {
    let userType: 'teacher' | 'student';
    let claims: { [key: string]: any };

    if (accessKey === TEACHER_KEY) {
      userType = 'teacher';
      claims = {
        classSections: { [CLASS_SECTION_ID]: 'teacher' },
      };
    } else if (accessKey === STUDENT_KEY) {
      userType = 'student';
      claims = {
        classSections: { [CLASS_SECTION_ID]: 'student' },
      };
    } else {
      throw new Error('Invalid access key.');
    }

    try {
      const customToken = await admin.auth().createCustomToken(uid, claims);
      return { customToken, userType };
    } catch (error) {
      console.error('Error creating custom token:', error);
      throw new Error('Failed to generate authentication token.');
    }
  }
);
