import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';

import { getGoogleCredentials } from '@/lib/google-auth';

export const ai = genkit({
  plugins: [vertexAI({
    location: 'us-central1',
    projectId: 'gen-lang-client-0411255761',
    googleAuth: {
      credentials: getGoogleCredentials()
    }
  })],
  model: 'vertexai/gemini-2.0-flash-exp',
});
