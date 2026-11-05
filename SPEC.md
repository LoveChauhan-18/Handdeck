# HandDeck: VR Study Buddy (Meta VR Start Developer Competition 2026)

## Concept
A seated, controller-free WebXR study app. Floating flashcards sit in front of the user. The user pinch-grabs a card, brings it to an AI teacher, answers a question by voice, then throws/places the card into a "Know" or "Revise" zone. Palm-up gesture asks for a hint.

## Hard rules (competition)
- Hands-only: entire experience completable with hand tracking, no controllers.
- Seated: everything within ~60 cm reach of the user.
- Fast start; one full session in under 10 minutes.
- Core experience must be original (not a thin wrapper around an AI service).
- Must run in a browser on Meta Quest (WebXR) and be testable in an XR emulator.

## Stack
- frontend/: Immersive Web SDK (IWSDK), JavaScript/TypeScript
- backend/: Python FastAPI (question generation, feedback, voice proxy)
- Voice: browser speechSynthesis / Web Speech API first; ElevenLabs later (API key only on backend)
- Hosting: frontend on GitHub Pages, backend on Render/Railway (CORS enabled, HTTPS)

## Milestones
1. 5 dummy cards, pinch-grab and move them, works in XR emulator.
2. Teacher area trigger, hardcoded questions, Know/Revise zones with throw/drop.
3. Voice: teacher speaks, user answers by voice.
4. FastAPI: generate cards/questions from a topic, give short feedback.
5. Hand polish: palm-up hint, visual feedback (glow, sound), pause/resume.
6. Seated optimization and 10-minute session test.

## Working rules for the agent
- Work on one milestone at a time; ask before starting the next.
- Keep code simple and commented. No unnecessary dependencies.
- Never put API keys in frontend code.
- Commit after each working step.
