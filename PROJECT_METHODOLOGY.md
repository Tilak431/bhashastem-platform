# Project Methodology: BhashaSTEM Platform

## 1. Project Overview
**BhashaSTEM** is a vernacular STEM learning platform designed to bridge the language barrier in education using advanced Agentic AI. The platform provides localized, high-quality video content by dynamically dubbing and translating educational resources into regional languages (e.g., Hindi, Tamil, Telugu) while maintaining visual fidelity and engagement.

## 2. Technology Stack

### Frontend Architecture
- **Framework**: **Next.js 15** (App Router) for server-side rendering and static generation.
- **Language**: **TypeScript** for type safety and robust codebases.
- **Styling System**:
  - **Tailwind CSS v3**: Utility-first styling.
  - **Shadcn UI**: Accessible, reusable component primitives (Radix UI based).
  - **CSS Variables**: For dynamic "Deep Void" Dark Mode and "Neon" theming.
  - **Lucide React**: Consistent iconography.
  - **Next-Themes**: System-aware theme switching (Light/Dark).
- **State Management**: React Hooks (`useState`, `useEffect`, `useContext`).

### Backend & Infrastructure
- **Serverless Compute**: **Vercel Functions** (Next.js API Routes) for AI orchestration.
- **Database**: **Firebase Firestore** (NoSQL) for real-time data syncing (Resources, Users, Watch History).
- **Storage**: **Firebase Storage** & **Cloudinary** for video and asset management.
- **Authentication**: **Firebase Auth** (implied support structure for scaling).

### AI & Agents Core
- **Orchestration**: **Google Genkit** (`@genkit-ai/*`) for managing AI flows and prompts.
- **LLM Models**:
  - **Gemini 1.5 Flash**: Used for high-speed transcription, translation, and semantic understanding.
  - **Gemini 1.5 Pro**: Used for complex reasoning and "Teacher Agent" personas.
- **Audio Synthesis**: **Google Cloud Text-to-Speech** (Neural2 voices) for high-quality regional dubbing.
- **Vector Search**: **Genkit RAG** (Retrieval Augmented Generation) for identifying relevant learning resources.

## 3. Core Methodologies & Algorithms

### A. The "Smart Sync" AI Dubbing Pipeline
A custom-engineered pipeline to solve the "Lip Sync" problem in educational videos without altering the video frames.
1.  **Segmented Transcription**:
    -   The system analyzes the video using Gemini Multimodal to generate a timestamped transcript (SRT format logic).
    -   *Tech*: `generate-transcript` flow using Genkit.
2.  **Context-Aware Translation**:
    -   Transcripts are translated while preserving STEM terminology (e.g., "Velocity" is explained, not just transliterated).
    -   *Constraint*: The translated text is optimized for spoken duration.
3.  **Neural Audio Generation**:
    -   Text segments are converted to audio using Google Cloud TTS (`en-IN-Wavenet-D` for Indian English, etc.).
    -   *Optimization*: Audio is generated in chunks to prevent timeouts.
4.  **Client-Side Time Stretching (Smart Sync)**:
    -   *Problem*: Spoken Hindi often takes longer than spoken English.
    -   *Solution*: Instead of pausing the video (which breaks immersion), the player uses a **Time-Matching Algorithm**.
    -   If $AudioDuration > VideoSegmentDuration$, the audio speed is dynamically increased (up to 1.5x) to fit the video segment exactly.
    -   This ensures continuous, smooth playback just like a professional dub.

### B. Intelligent Content Library
-   **Methodology**: "Netflix for Education"
-   **Dynamic Thumbnails**:
    -   Uses YouTube Data API logic for valid IDs.
    -   Falls back to a **Neon Gradient Generator** for uploaded files to maintain visual consistency.
-   **Semantic Filtering**: Resources are tagged with metadata allowing for complex queries (Subject, Language, Grade).

### C. Advanced UI/UX System
-   **Design Philosophy**: "Futuristic Education". User engagement is driven by high-fidelity visuals.
-   **Theming Engine**:
    -   **Dark Mode ("Deep Void")**: Optimized for low-eye-strain night study, using `#0b0c15` backgrounds with `#a855f7` (Neon Purple) accents.
    -   **Glassmorphism**: Usage of `backdrop-blur-md` and semi-transparent borders to create depth and hierarchy.
-   **Accessibility**: High contrast ratios and aria-labels implementation via Radix primitives.

## 4. Development Workflow
1.  **Planning (Agentic)**: Breakdown of complex features (e.g., Sync Logic) into implementation plans.
2.  **Implementation**:
    -   Code is written in `src/app` (Next.js) for UI.
    -   AI logic resides in `src/ai/flows` (Genkit) to separate concerns.
3.  **Verification**:
    -   Git-based version control (`main` branch).
    -   Vercel automatic deployments for CI/CD.

## 5. Directory Structure
```
src/
├── ai/                 # Genkit flows (translation, recommendations)
├── app/                # Next.js App Router pages
│   ├── (app)/library   # Main content library
│   └── api/            # Serverless API endpoints
├── components/         # Shadcn UI primitives
├── firebase/           # Database config
└── lib/                # Utilities (time parsing, sync logic)
```
