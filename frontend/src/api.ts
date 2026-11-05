/**
 * HandDeck - Backend API Client (Milestone 4)
 * Handles /cards generation and /evaluate answer grading.
 * Enforces a strict 6-second timeout with zero-crash local fallbacks.
 */

import { CONFIG } from './config.js';
import type { FlashcardData } from './cards.js';

export interface EvaluationResult {
  verdict: 'correct' | 'partial' | 'wrong';
  feedback: string;
  isFallback: boolean;
}

export interface CardsResult {
  cards: FlashcardData[];
  isFallback: boolean;
  notice?: string;
}

const TOPIC_PALETTES: Record<string, { accentColor: string; badgeBg: string }> = {
  biology: { accentColor: '#38bdf8', badgeBg: 'rgba(56, 189, 248, 0.15)' },
  physics: { accentColor: '#a855f7', badgeBg: 'rgba(168, 85, 247, 0.15)' },
  space: { accentColor: '#f59e0b', badgeBg: 'rgba(245, 158, 11, 0.15)' },
  history: { accentColor: '#ec4899', badgeBg: 'rgba(236, 72, 153, 0.15)' },
  python: { accentColor: '#10b981', badgeBg: 'rgba(16, 185, 129, 0.15)' },
};

/** Curated local fallback flashcard sets for zero-crash demo guarantee */
const LOCAL_FALLBACK_DECKS: Record<string, FlashcardData[]> = {
  biology: [
    {
      id: 1,
      category: 'BIOLOGY',
      title: 'Cellular Energy',
      question: 'What is the primary function of Mitochondria in a cell?',
      answer: 'Generates ATP via cellular respiration to power biochemical processes.',
      accentColor: '#38bdf8',
      badgeBg: 'rgba(56, 189, 248, 0.15)',
    },
    {
      id: 2,
      category: 'BIOLOGY',
      title: 'Photosynthesis',
      question: 'Which plant organelle captures light to synthesize sugars?',
      answer: 'Chloroplasts contain chlorophyll that absorbs solar energy for carbon fixation.',
      accentColor: '#38bdf8',
      badgeBg: 'rgba(56, 189, 248, 0.15)',
    },
    {
      id: 3,
      category: 'BIOLOGY',
      title: 'DNA Base Pairs',
      question: 'Which nitrogenous bases pair together in DNA?',
      answer: 'Adenine pairs with Thymine (A-T); Cytosine pairs with Guanine (C-G).',
      accentColor: '#38bdf8',
      badgeBg: 'rgba(56, 189, 248, 0.15)',
    },
    {
      id: 4,
      category: 'BIOLOGY',
      title: 'Ribosomes',
      question: 'What fundamental process takes place at the ribosome?',
      answer: 'Translation of messenger RNA into polypeptides (protein synthesis).',
      accentColor: '#38bdf8',
      badgeBg: 'rgba(56, 189, 248, 0.15)',
    },
    {
      id: 5,
      category: 'BIOLOGY',
      title: 'Cell Membrane',
      question: 'What structural model describes the flexible lipid bilayer?',
      answer: 'The Fluid Mosaic Model of phospholipids and embedded proteins.',
      accentColor: '#38bdf8',
      badgeBg: 'rgba(56, 189, 248, 0.15)',
    },
  ],
  physics: [
    {
      id: 1,
      category: 'PHYSICS',
      title: "Newton's 1st Law",
      question: 'What happens to an object when net external force is zero?',
      answer: 'It remains at rest or maintains constant velocity in a straight line.',
      accentColor: '#a855f7',
      badgeBg: 'rgba(168, 85, 247, 0.15)',
    },
    {
      id: 2,
      category: 'PHYSICS',
      title: 'Speed of Light',
      question: 'What is the speed of light (c) in vacuum?',
      answer: '~299,792 km/s (3 x 10^8 m/s). It is the universal speed limit.',
      accentColor: '#a855f7',
      badgeBg: 'rgba(168, 85, 247, 0.15)',
    },
    {
      id: 3,
      category: 'PHYSICS',
      title: '1st Law Thermo',
      question: 'What does the law of conservation of energy state?',
      answer: 'Energy cannot be created or destroyed, only transformed from one form to another.',
      accentColor: '#a855f7',
      badgeBg: 'rgba(168, 85, 247, 0.15)',
    },
    {
      id: 4,
      category: 'PHYSICS',
      title: 'Gravity',
      question: 'How does gravitational force change when separation distance doubles?',
      answer: 'Inverse-square law: gravitational force decreases to one-fourth (1/4).',
      accentColor: '#a855f7',
      badgeBg: 'rgba(168, 85, 247, 0.15)',
    },
    {
      id: 5,
      category: 'PHYSICS',
      title: 'Electromagnetism',
      question: 'What fundamental force governs interactions between charged particles?',
      answer: 'The electromagnetic force, described by Coulomb and Maxwell.',
      accentColor: '#a855f7',
      badgeBg: 'rgba(168, 85, 247, 0.15)',
    },
  ],
  space: [
    {
      id: 1,
      category: 'SPACE',
      title: 'Event Horizon',
      question: 'What boundary marks the point of no return around a black hole?',
      answer: 'The Event Horizon, where escape velocity exceeds the speed of light.',
      accentColor: '#f59e0b',
      badgeBg: 'rgba(245, 158, 11, 0.15)',
    },
    {
      id: 2,
      category: 'SPACE',
      title: 'Nuclear Fusion',
      question: 'What reaction powers our Sun and other main-sequence stars?',
      answer: 'Hydrogen nuclei fusing into Helium under extreme gravitational pressure.',
      accentColor: '#f59e0b',
      badgeBg: 'rgba(245, 158, 11, 0.15)',
    },
    {
      id: 3,
      category: 'SPACE',
      title: 'Habitable Zone',
      question: 'What defines the Goldilocks or habitable zone around a star?',
      answer: 'The orbital range where temperatures allow liquid water on planetary surfaces.',
      accentColor: '#f59e0b',
      badgeBg: 'rgba(245, 158, 11, 0.15)',
    },
    {
      id: 4,
      category: 'SPACE',
      title: 'Hubble Expansion',
      question: 'What key observation proved that the universe is expanding?',
      answer: 'Redshift of spectral lines in light from distant galaxies.',
      accentColor: '#f59e0b',
      badgeBg: 'rgba(245, 158, 11, 0.15)',
    },
    {
      id: 5,
      category: 'SPACE',
      title: 'Dark Matter',
      question: 'What invisible mass holds rotating spiral galaxies together?',
      answer: 'Dark matter, detected through its gravitational influence on visible matter.',
      accentColor: '#f59e0b',
      badgeBg: 'rgba(245, 158, 11, 0.15)',
    },
  ],
  history: [
    {
      id: 1,
      category: 'HISTORY',
      title: 'Neolithic Era',
      question: 'What shift transitioned humanity from nomadic foraging to farming?',
      answer: 'The Agricultural Revolution around 10,000 BCE in the Fertile Crescent.',
      accentColor: '#ec4899',
      badgeBg: 'rgba(236, 72, 153, 0.15)',
    },
    {
      id: 2,
      category: 'HISTORY',
      title: 'Printing Press',
      question: 'Who invented movable-type printing in 1440s Europe?',
      answer: 'Johannes Gutenberg, sparking the rapid spread of literacy and science.',
      accentColor: '#ec4899',
      badgeBg: 'rgba(236, 72, 153, 0.15)',
    },
    {
      id: 3,
      category: 'HISTORY',
      title: 'Steam Power',
      question: 'Which invention accelerated the Industrial Revolution in the 1700s?',
      answer: 'James Watt’s improved coal-fired steam engine powering factory machinery.',
      accentColor: '#ec4899',
      badgeBg: 'rgba(236, 72, 153, 0.15)',
    },
    {
      id: 4,
      category: 'HISTORY',
      title: 'Silk Road',
      question: 'What ancient Eurasian trade network linked China to the Mediterranean?',
      answer: 'The Silk Road, carrying silk, spices, technologies, and philosophies.',
      accentColor: '#ec4899',
      badgeBg: 'rgba(236, 72, 153, 0.15)',
    },
    {
      id: 5,
      category: 'HISTORY',
      title: 'Heliocentrism',
      question: 'Which scientific model placed the Sun at the center of planetary orbits?',
      answer: 'The Copernican heliocentric model, validated by Galileo and Kepler.',
      accentColor: '#ec4899',
      badgeBg: 'rgba(236, 72, 153, 0.15)',
    },
  ],
  python: [
    {
      id: 1,
      category: 'PYTHON',
      title: 'Immutability',
      question: 'In Python, which standard sequence is immutable: list or tuple?',
      answer: 'Tuples are immutable; lists can be modified after creation.',
      accentColor: '#10b981',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
    },
    {
      id: 2,
      category: 'PYTHON',
      title: 'Comprehensions',
      question: 'What concise syntax creates transformed lists in a single line?',
      answer: '[expression for item in iterable if condition].',
      accentColor: '#10b981',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
    },
    {
      id: 3,
      category: 'PYTHON',
      title: 'Dict Lookup',
      question: 'What is the average time complexity of key lookup in a Python dict?',
      answer: 'O(1) constant time, implemented with an efficient hash table.',
      accentColor: '#10b981',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
    },
    {
      id: 4,
      category: 'PYTHON',
      title: 'Generators',
      question: 'What keyword converts a standard function into a memory-saving generator?',
      answer: 'yield produces values lazily one at a time on demand.',
      accentColor: '#10b981',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
    },
    {
      id: 5,
      category: 'PYTHON',
      title: 'Environments',
      question: 'Why do developers create virtual environments using venv?',
      answer: 'To isolate dependencies per project and avoid library version collisions.',
      accentColor: '#10b981',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
    },
  ],
};

/**
 * Fetch topic cards from FastAPI POST /cards.
 * Aborts if backend takes > 6 seconds and falls back to local curated deck.
 */
export async function fetchTopicCards(topic: string, count = 5): Promise<CardsResult> {
  const cleanTopic = topic.toLowerCase().trim();
  const palette = TOPIC_PALETTES[cleanTopic] || {
    accentColor: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${CONFIG.BACKEND_URL}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, count }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data: any[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid cards array returned');
    }

    const cards: FlashcardData[] = data.slice(0, count).map((item, index) => ({
      id: item.id || index + 1,
      category: (item.category || topic).toUpperCase(),
      title: item.title || `Concept #${index + 1}`,
      question: item.question,
      answer: item.key_concept || item.answer || '',
      accentColor: palette.accentColor,
      badgeBg: palette.badgeBg,
    }));

    return { cards, isFallback: false };
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(`[API] /cards failed (${err.message || 'timeout'}). Using fallback deck for "${topic}".`);

    const fallbackCards = LOCAL_FALLBACK_DECKS[cleanTopic] || LOCAL_FALLBACK_DECKS['biology'];
    return {
      cards: fallbackCards.slice(0, count),
      isFallback: true,
      notice: 'Backend unreachable / timeout (>6s) - Using offline cards',
    };
  }
}

/**
 * Evaluate user's answer via FastAPI POST /evaluate.
 * Falls back to local semantic logic if timeout > 6s or backend unreachable.
 */
export async function evaluateAnswer(
  question: string,
  keyConcept: string,
  userAnswer: string
): Promise<EvaluationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${CONFIG.BACKEND_URL}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        key_concept: keyConcept,
        user_answer: userAnswer,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data.verdict || !data.feedback) {
      throw new Error('Malformed evaluation response');
    }

    return {
      verdict: data.verdict,
      feedback: data.feedback,
      isFallback: false,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(`[API] /evaluate failed (${err.message || 'timeout'}). Using fallback grading.`);

    // Local semantic grading
    const ans = userAnswer.toLowerCase().trim();
    const concept = keyConcept.toLowerCase();

    const unsurePhrases = ['not sure', 'dont know', "don't know", 'no idea', 'idk', 'unsure', 'forgot'];
    if (unsurePhrases.some((p) => ans.includes(p))) {
      return {
        verdict: 'wrong',
        feedback: `That's okay! ${keyConcept}. Recommended to review in Revise.`,
        isFallback: true,
      };
    }

    if (ans === 'i knew it' || ans.includes('correct') || ans.includes('got it')) {
      return {
        verdict: 'correct',
        feedback: `Spot on! ${keyConcept}. Ready to sort into Know!`,
        isFallback: true,
      };
    }

    // Word overlap check
    const conceptWords = concept.split(/\W+/).filter((w) => w.length > 3);
    const userWords = ans.split(/\W+/).filter((w) => w.length > 3);
    const overlap = conceptWords.filter((w) => userWords.includes(w));

    if (overlap.length >= 2) {
      return {
        verdict: 'correct',
        feedback: `Great job! ${keyConcept}. Place into Know tray!`,
        isFallback: true,
      };
    } else if (overlap.length === 1) {
      return {
        verdict: 'partial',
        feedback: `You are close! Remember: ${keyConcept}. Consider dropping in Revise.`,
        isFallback: true,
      };
    } else {
      return {
        verdict: 'wrong',
        feedback: `Good attempt! The core concept is: ${keyConcept}. Recommended: Revise.`,
        isFallback: true,
      };
    }
  }
}

