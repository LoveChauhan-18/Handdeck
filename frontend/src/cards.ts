/**
 * HandDeck - Seated WebXR Flashcards
 * Milestone 1, 2 & 3: 5 Interactive Grabbable Flashcards with Voice & Zone Sorting
 */

import {
  BoxGeometry,
  CanvasTexture,
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector3,
  Euler,
} from 'three';
import {
  createComponent,
  createSystem,
  DistanceGrabbable,
  Entity,
  Hovered,
  Grabbed,
  MovementMode,
  RayInteractable,
  Types,
  World,
} from '@iwsdk/core';
import {
  isInsideKnowZone,
  isInsideReviseZone,
  canDropIntoZone,
  snapCardToZone,
  updateStudyBuddy,
  resetStudyBuddy,
} from './study-buddy.js';
import { voice } from './voice.js';

export interface FlashcardData {
  id: number;
  category: string;
  title: string;
  question: string;
  answer: string;
  accentColor: string;
  badgeBg: string;
}

export const DUMMY_CARDS: FlashcardData[] = [
  {
    id: 1,
    category: 'BIOLOGY',
    title: 'Cellular Energy',
    question: 'What is the primary function of Mitochondria in a cell?',
    answer: 'Generates ATP via cellular respiration to power biochemical processes.',
    accentColor: '#38bdf8', // Sky Blue
    badgeBg: 'rgba(56, 189, 248, 0.15)',
  },
  {
    id: 2,
    category: 'PHYSICS',
    title: "Newton's 1st Law",
    question: 'What happens to an object when net external force is zero?',
    answer: 'It remains at rest or continues moving at constant velocity.',
    accentColor: '#a855f7', // Purple
    badgeBg: 'rgba(168, 85, 247, 0.15)',
  },
  {
    id: 3,
    category: 'ASTRONOMY',
    title: 'Speed of Light',
    question: 'What is the speed of light (c) in vacuum?',
    answer: '~299,792 km/s (3 x 10^8 m/s). It is the universal speed limit.',
    accentColor: '#f59e0b', // Amber
    badgeBg: 'rgba(245, 158, 11, 0.15)',
  },
  {
    id: 4,
    category: 'CHEMISTRY',
    title: 'Atomic Number',
    question: "What fundamental property defines an element's identity?",
    answer: 'The number of protons in its atomic nucleus (Z).',
    accentColor: '#10b981', // Emerald
    badgeBg: 'rgba(16, 185, 129, 0.15)',
  },
  {
    id: 5,
    category: 'GENETICS',
    title: 'DNA Base Pairs',
    question: 'Which nitrogenous bases pair together in DNA?',
    answer: 'Adenine pairs with Thymine (A-T); Cytosine pairs with Guanine (C-G).',
    accentColor: '#ec4899', // Pink
    badgeBg: 'rgba(236, 72, 153, 0.15)',
  },
];

/** Component tagging flashcard entities with initial transform information */
export const Flashcard = createComponent(
  'Flashcard',
  {
    cardId: { type: Types.Int32, default: 0 },
    initialX: { type: Types.Float32, default: 0 },
    initialY: { type: Types.Float32, default: 0 },
    initialZ: { type: Types.Float32, default: 0 },
    initialRotY: { type: Types.Float32, default: 0 },
    initialRotX: { type: Types.Float32, default: 0 },
  },
  'Interactive study flashcard'
);

/**
 * Runtime record for a flashcard — holds its mesh, materials, initial
 * transform, card data, and Milestone 2+3 snap/lock state.
 */
export interface CardRecord {
  entity: Entity;
  mesh: Mesh;
  frontMaterial: MeshStandardMaterial;
  baseColor: Color;
  initialPos: Vector3;
  initialRot: Euler;
  data: FlashcardData;
  lockedZone: 'know' | 'revise' | null;
  isSnapping: boolean;
  hasBeenMoved: boolean;
  snapTargetPos: Vector3;
  snapTargetRot: Euler;
  snapProgress: number;
}

/** Module-level registry – populated by setupFlashcards() */
const cardRecords: CardRecord[] = [];

/** Expose records to other modules (study-buddy, panel) */
export function getCardRecords(): CardRecord[] {
  return cardRecords;
}

// ----- Canvas helpers (private) ------------------------------------------------

/** Helper to wrap text cleanly on HTML5 canvas */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(' ');
  let line = '';
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
  return y + lineHeight;
}

/** Draws rounded rectangle path on canvas */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** Generate a sharp high-res CanvasTexture for the front of a flashcard */
function createCardFrontTexture(card: FlashcardData): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1400;
  const ctx = canvas.getContext('2d')!;

  // Background gradient (sleek dark card)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 1400);
  bgGrad.addColorStop(0, '#1c1f26');
  bgGrad.addColorStop(1, '#0e1015');

  roundRect(ctx, 16, 16, 992, 1368, 44);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // Accent border
  ctx.lineWidth = 14;
  ctx.strokeStyle = card.accentColor;
  ctx.stroke();

  // Subtle inner border
  roundRect(ctx, 32, 32, 960, 1336, 36);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.stroke();

  // Category Pill Badge
  roundRect(ctx, 80, 80, 360, 68, 34);
  ctx.fillStyle = card.badgeBg;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = card.accentColor;
  ctx.stroke();

  ctx.fillStyle = card.accentColor;
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${card.category} - #${card.id}`, 260, 114);

  // Card count indicator (top right)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = '600 28px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('SEATED VR', 930, 114);

  // Title
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillText(card.title, 80, 230);

  // Horizontal divider
  const divGrad = ctx.createLinearGradient(80, 270, 944, 270);
  divGrad.addColorStop(0, card.accentColor);
  divGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.2)');
  divGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(80, 270);
  ctx.lineTo(944, 270);
  ctx.stroke();

  // Question Block
  ctx.fillStyle = card.accentColor;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('QUESTION', 80, 330);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 44px system-ui, sans-serif';
  wrapText(ctx, card.question, 80, 400, 864, 62);

  // Answer Container Box
  roundRect(ctx, 80, 680, 864, 460, 32);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('KEY CONCEPT / ANSWER', 120, 740);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '400 38px system-ui, sans-serif';
  wrapText(ctx, card.answer, 120, 810, 784, 56);

  // Bottom interaction hint
  roundRect(ctx, 80, 1200, 864, 110, 26);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = card.badgeBg;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = card.accentColor;
  ctx.font = '600 32px system-ui, sans-serif';
  ctx.fillText('Pinch to Grab & Move Card', 512, 1255);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  return texture;
}

/** Generate texture for card back */
function createCardBackTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1400;
  const ctx = canvas.getContext('2d')!;

  const bgGrad = ctx.createLinearGradient(0, 0, 1024, 1400);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(1, '#020617');

  roundRect(ctx, 16, 16, 992, 1368, 44);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  ctx.lineWidth = 14;
  ctx.strokeStyle = '#38bdf8';
  ctx.stroke();

  // Pattern lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 4;
  for (let i = -1400; i < 2400; i += 60) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 1400, 1400);
    ctx.stroke();
  }

  // Centered logo medallion
  roundRect(ctx, 212, 500, 600, 400, 40);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#38bdf8';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('HANDDECK', 512, 650);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 32px system-ui, sans-serif';
  ctx.fillText('VR Study Buddy', 512, 720);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = '400 24px system-ui, sans-serif';
  ctx.fillText('Meta Quest WebXR - Hands Only', 512, 780);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  return texture;
}

/**
 * Creates and arranges 5 flashcards in a seated-friendly arc within 60 cm of user.
 * Radius: 0.48 m (~48 cm), comfortable arm reach when seated.
 * Height: 1.15 m, natural seated chest/eye level.
 */
export function setupFlashcards(world: World): void {
  cardRecords.length = 0;

  const cardWidth = 0.14; // 14 cm
  const cardHeight = 0.19; // 19 cm
  const cardDepth = 0.006; // 6 mm
  const arcRadius = 0.48; // 48 cm from user (strictly < 60 cm)
  const cardElevation = 1.15; // 1.15 m above floor

  // Angles spread evenly across a seated arc (-36° to +36°)
  const angles = [-0.628, -0.314, 0.0, 0.314, 0.628];
  const backTexture = createCardBackTexture();

  DUMMY_CARDS.forEach((card, index) => {
    const angle = angles[index];
    const posX = arcRadius * Math.sin(angle);
    const posZ = -arcRadius * Math.cos(angle);
    const posY = cardElevation;

    // Orientation: face the origin (user at 0, 1.15, 0), with gentle 8° backward tilt
    const rotY = -angle;
    const rotX = -0.14; // ~8 degrees backward tilt for seated viewing

    const frontTexture = createCardFrontTexture(card);
    const geometry = new BoxGeometry(cardWidth, cardHeight, cardDepth);

    // Box materials: [right, left, top, bottom, front, back]
    const edgeMaterial = new MeshStandardMaterial({
      color: 0x1f242d,
      roughness: 0.6,
      metalness: 0.2,
    });

    const frontMaterial = new MeshStandardMaterial({
      map: frontTexture,
      roughness: 0.35,
      metalness: 0.1,
      emissive: new Color(0x000000),
      emissiveIntensity: 0.0,
    });

    const backMaterial = new MeshStandardMaterial({
      map: backTexture,
      roughness: 0.4,
      metalness: 0.1,
    });

    const materials = [
      edgeMaterial,
      edgeMaterial,
      edgeMaterial,
      edgeMaterial,
      frontMaterial, // Face 4: +Z (Front)
      backMaterial,  // Face 5: -Z (Back)
    ];

    const mesh = new Mesh(geometry, materials);
    mesh.name = `flashcard-${card.id}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    mesh.position.set(posX, posY, posZ);
    mesh.rotation.set(rotX, rotY, 0);

    // Create ECS Transform entity
    const entity = world.createTransformEntity(mesh);

    // Tag with custom Flashcard component
    entity.addComponent(Flashcard, {
      cardId: card.id,
      initialX: posX,
      initialY: posY,
      initialZ: posZ,
      initialRotY: rotY,
      initialRotX: rotX,
    });

    // Make ray-interactable (supports hand tracking rays & desktop mouse pointer)
    entity.addComponent(RayInteractable);

    // Make grabbable via IWSDK GrabSystem
    entity.addComponent(DistanceGrabbable, {
      movementMode: MovementMode.MoveFromTarget,
      translate: true,
      rotate: true,
    });

    // Push full record including Milestone 2 snap/lock fields
    cardRecords.push({
      entity,
      mesh,
      frontMaterial,
      baseColor: new Color(card.accentColor),
      initialPos: new Vector3(posX, posY, posZ),
      initialRot: new Euler(rotX, rotY, 0),
      data: card,
      lockedZone: null,
      isSnapping: false,
      hasBeenMoved: false,
      snapTargetPos: new Vector3(),
      snapTargetRot: new Euler(),
      snapProgress: 0,
    });
  });
}

/** Resets all flashcards back to their default seated arc configuration */
export function resetFlashcards(): void {
  resetStudyBuddy(cardRecords);
}

const tempPos = new Vector3();

/**
 * ECS System managing interactive hover/grab visual feedback AND
 * Milestone 2+3 zone-detection + snap animation for flashcards.
 */
export class FlashcardSystem extends createSystem({
  cards: { required: [Flashcard] },
  hoveredCards: { required: [Flashcard, Hovered] },
  grabbedCards: { required: [Flashcard, Grabbed] },
}) {
  update(delta: number, time: number): void {
    // ---- 1. Hover / Grab visual feedback -------------------------------------
    cardRecords.forEach((record) => {
      const entity = record.entity;
      const isGrabbed = entity.hasComponent(Grabbed);
      const isHovered = entity.hasComponent(Hovered);

      if (isGrabbed) {
        record.hasBeenMoved = true;
        // Unlock audio on first user pinch / grab
        voice.unlockAudio();
      }

      if (record.lockedZone) {
        // Locked cards keep their placement glow
        return;
      }

      if (isGrabbed) {
        // Bright grab highlight & slight scale up
        record.frontMaterial.emissive.copy(record.baseColor);
        record.frontMaterial.emissiveIntensity = 0.45;
        record.mesh.scale.set(1.05, 1.05, 1.05);
      } else if (isHovered) {
        // Subtle hover glow
        record.frontMaterial.emissive.copy(record.baseColor);
        record.frontMaterial.emissiveIntensity = 0.22;
        record.mesh.scale.set(1.02, 1.02, 1.02);
      } else {
        // Normal resting state
        record.frontMaterial.emissiveIntensity = 0.0;
        record.mesh.scale.set(1.0, 1.0, 1.0);
      }
    });

    // ---- 2. Delegate Teacher animations, voice, and trigger detection ---------
    updateStudyBuddy(delta, time, cardRecords);

    // ---- 3. Zone detection: check released unlocked cards --------------------
    for (const card of cardRecords) {
      if (card.lockedZone || card.isSnapping) continue;
      // Skip while actively held
      if (card.entity.hasComponent(Grabbed)) continue;
      // Only snap if card was actually grabbed and moved
      if (!card.hasBeenMoved) continue;

      card.mesh.getWorldPosition(tempPos);
      if (isInsideKnowZone(tempPos)) {
        if (canDropIntoZone()) {
          snapCardToZone(card, 'know');
        }
      } else if (isInsideReviseZone(tempPos)) {
        if (canDropIntoZone()) {
          snapCardToZone(card, 'revise');
        }
      }
    }

    // ---- 4. Smooth snap animation --------------------------------------------
    for (const card of cardRecords) {
      if (!card.isSnapping) continue;

      card.snapProgress = Math.min(1, card.snapProgress + delta * 6); // fast approach ~0.17 s
      const t = card.snapProgress;

      // Linear interpolation toward snap target
      card.mesh.position.lerpVectors(card.mesh.position, card.snapTargetPos, t);
      card.mesh.rotation.x += (card.snapTargetRot.x - card.mesh.rotation.x) * t;
      card.mesh.rotation.y += (card.snapTargetRot.y - card.mesh.rotation.y) * t;
      card.mesh.rotation.z += (card.snapTargetRot.z - card.mesh.rotation.z) * t;

      if (card.snapProgress >= 1) {
        card.isSnapping = false;
        // Final exact placement
        card.mesh.position.copy(card.snapTargetPos);
        card.mesh.rotation.copy(card.snapTargetRot);
      }
    }
  }
}
