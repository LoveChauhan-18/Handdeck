/**
 * HandDeck - Study Buddy Mechanics (Milestone 2)
 * Teacher Avatar, Question Display, Know/Revise Zones, Snap & Lock, and Counters.
 */

import {
  BoxGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Euler,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three';
import { DistanceGrabbable, MovementMode, RayInteractable, World } from '@iwsdk/core';
import type { CardRecord, FlashcardData } from './cards.js';

export interface StudyBuddyState {
  knowCount: number;
  reviseCount: number;
  activeQuestionCard: FlashcardData | null;
  lastSortedMessage: string | null;
}

export const studyBuddyState: StudyBuddyState = {
  knowCount: 0,
  reviseCount: 0,
  activeQuestionCard: null,
  lastSortedMessage: null,
};

// Seated positions (all strictly within 60 cm reach of user at 0, 1.15, 0)
export const TEACHER_POS = new Vector3(0, 1.34, -0.50);
export const TEACHER_TRIGGER_POS = new Vector3(0, 1.20, -0.45);
export const TEACHER_TRIGGER_RADIUS = 0.22;

export const REVISE_ZONE_POS = new Vector3(-0.36, 0.95, -0.34); // Left (Orange)
export const KNOW_ZONE_POS = new Vector3(0.36, 0.95, -0.34);   // Right (Green)
export const ZONE_HALF_WIDTH = 0.16; // 32 cm wide hit-box (> 20 cm)
export const ZONE_HALF_DEPTH = 0.15; // 30 cm deep hit-box

let teacherGroup: Group | null = null;
let teacherScreenMesh: Mesh | null = null;
let teacherScreenTexture: CanvasTexture | null = null;
let teacherScreenCtx: CanvasRenderingContext2D | null = null;
let teacherOrb: Mesh | null = null;
let teacherRing1: Mesh | null = null;
let teacherRing2: Mesh | null = null;
let triggerRingMesh: Mesh | null = null;

let knowZoneGroup: Group | null = null;
let knowZoneTexture: CanvasTexture | null = null;
let knowZoneCtx: CanvasRenderingContext2D | null = null;
let knowBadgeMesh: Mesh | null = null;
let knowBadgeTexture: CanvasTexture | null = null;

let reviseZoneGroup: Group | null = null;
let reviseZoneTexture: CanvasTexture | null = null;
let reviseZoneCtx: CanvasRenderingContext2D | null = null;
let reviseBadgeMesh: Mesh | null = null;
let reviseBadgeTexture: CanvasTexture | null = null;

/** Helper for canvas rounded rectangles */
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

/** Helper for clean text wrapping */
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

/** Render Teacher screen */
function renderTeacherScreen(
  card: FlashcardData | null,
  statusOverride?: string
): void {
  if (!teacherScreenCtx || !teacherScreenTexture) return;
  const ctx = teacherScreenCtx;
  const w = 1024;
  const h = 600;

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, '#020617');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Outer border
  roundRect(ctx, 10, 10, w - 20, h - 20, 28);
  ctx.lineWidth = 8;
  ctx.strokeStyle = card ? card.accentColor : '#38bdf8';
  ctx.stroke();

  // Top header bar
  roundRect(ctx, 40, 36, 440, 56, 28);
  ctx.fillStyle = card ? 'rgba(56, 189, 248, 0.2)' : 'rgba(14, 165, 233, 0.15)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = card ? card.accentColor : '#38bdf8';
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎓 TEACHER COMPANION', 260, 64);

  // Status badge (top right)
  roundRect(ctx, w - 340, 36, 300, 56, 28);
  ctx.fillStyle = card
    ? 'rgba(34, 197, 94, 0.2)'
    : statusOverride
    ? 'rgba(249, 115, 22, 0.2)'
    : 'rgba(255, 255, 255, 0.08)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = card
    ? '#22c55e'
    : statusOverride
    ? '#f97316'
    : 'rgba(255, 255, 255, 0.2)';
  ctx.stroke();

  ctx.fillStyle = card ? '#4ade80' : statusOverride ? '#fb923c' : '#94a3b8';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const badgeLabel = card
    ? `CARD #${card.id} IN FOCUS`
    : statusOverride || 'WAITING FOR CARD';
  ctx.fillText(badgeLabel, w - 190, 64);

  ctx.textAlign = 'left';

  if (card) {
    // Category & Title
    ctx.fillStyle = card.accentColor;
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText(`${card.category} • ${card.title.toUpperCase()}`, 50, 140);

    // Question Box
    roundRect(ctx, 40, 165, w - 80, 245, 24);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px system-ui, sans-serif';
    wrapText(ctx, card.question, 70, 230, w - 140, 52);

    // Guidance footer
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 26px system-ui, sans-serif';
    ctx.fillText('👉 Drop card in:  KNOW (Right / Green)  or  REVISE (Left / Orange)', 50, 450);
  } else {
    // Idle state or sorted message
    if (statusOverride) {
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 44px system-ui, sans-serif';
      ctx.fillText(statusOverride, 50, 190);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '400 32px system-ui, sans-serif';
      ctx.fillText('Great job! Pick up your next card from the floating arc.', 50, 260);
      ctx.fillText('Bring it here to read its question.', 50, 315);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px system-ui, sans-serif';
      ctx.fillText('Bring a flashcard here to test yourself!', 50, 200);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '400 30px system-ui, sans-serif';
      ctx.fillText('1. Grab any floating card with pinch gesture.', 50, 270);
      ctx.fillText('2. Hold or drop it in front of me to read the question.', 50, 325);
      ctx.fillText('3. Sort into KNOW (Green) or REVISE (Orange) tray.', 50, 380);
    }
  }

  // Bottom stats counter strip
  roundRect(ctx, 40, 500, w - 80, 64, 20);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.stroke();

  ctx.font = '600 24px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#22c55e';
  ctx.fillText(`✓ KNOW: ${studyBuddyState.knowCount}`, 260, 532);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillText('|', 512, 532);

  ctx.fillStyle = '#f97316';
  ctx.fillText(`↺ REVISE: ${studyBuddyState.reviseCount}`, 760, 532);

  teacherScreenTexture.needsUpdate = true;
}

/** Render Zone surface texture */
function renderZoneSurface(
  ctx: CanvasRenderingContext2D,
  texture: CanvasTexture,
  type: 'know' | 'revise',
  count: number
): void {
  const w = 1024;
  const h = 860;
  const isKnow = type === 'know';
  const mainColor = isKnow ? '#22c55e' : '#f97316';
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, isKnow ? '#052e16' : '#431407');
  bgGrad.addColorStop(1, '#090d16');

  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Border
  roundRect(ctx, 16, 16, w - 32, h - 32, 40);
  ctx.lineWidth = 18;
  ctx.strokeStyle = mainColor;
  ctx.stroke();

  // Header Title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Icon symbol
  ctx.fillStyle = mainColor;
  ctx.font = 'bold 150px system-ui, sans-serif';
  ctx.fillText(isKnow ? '✓' : '↺', w / 2, 220);

  // Label
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 74px system-ui, sans-serif';
  ctx.fillText(isKnow ? 'KNOW' : 'REVISE', w / 2, 390);

  // Counter Box
  roundRect(ctx, 180, 480, w - 360, 180, 36);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = mainColor;
  ctx.stroke();

  ctx.fillStyle = mainColor;
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText(`${count} CARDS`, w / 2, 570);

  // Instructions
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 34px system-ui, sans-serif';
  ctx.fillText(
    isKnow ? 'Drop here if mastered' : 'Drop here to practice again',
    w / 2,
    730
  );

  texture.needsUpdate = true;
}

/** Render floating badge above zone */
function renderBadge(
  texture: CanvasTexture,
  type: 'know' | 'revise',
  count: number
): void {
  const canvas = texture.image as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const isKnow = type === 'know';
  const color = isKnow ? '#22c55e' : '#f97316';

  ctx.clearRect(0, 0, w, h);

  roundRect(ctx, 6, 6, w - 12, h - 12, 28);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = color;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText(isKnow ? `KNOW: ${count}` : `REVISE: ${count}`, w / 2, h / 2);

  texture.needsUpdate = true;
}

/** Create and initialize Teacher avatar and display screen */
export function createTeacher(world: World): void {
  teacherGroup = new Group();
  teacherGroup.name = 'teacher-area';
  teacherGroup.position.copy(TEACHER_POS);

  // Avatar Orb (AI Core)
  const orbGeo = new SphereGeometry(0.065, 32, 24);
  const orbMat = new MeshStandardMaterial({
    color: 0x0284c7,
    emissive: new Color('#38bdf8'),
    emissiveIntensity: 0.65,
    roughness: 0.15,
    metalness: 0.85,
  });
  teacherOrb = new Mesh(orbGeo, orbMat);
  teacherOrb.position.set(0, 0.22, 0);
  teacherGroup.add(teacherOrb);

  // Rotating Gyroscope Rings
  const ring1Geo = new TorusGeometry(0.10, 0.0035, 16, 64);
  const ringMat = new MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: new Color('#38bdf8'),
    emissiveIntensity: 0.5,
    roughness: 0.2,
  });
  teacherRing1 = new Mesh(ring1Geo, ringMat);
  teacherRing1.position.copy(teacherOrb.position);
  teacherRing1.rotation.x = Math.PI / 4;
  teacherGroup.add(teacherRing1);

  const ring2Geo = new TorusGeometry(0.12, 0.003, 16, 64);
  teacherRing2 = new Mesh(ring2Geo, ringMat);
  teacherRing2.position.copy(teacherOrb.position);
  teacherRing2.rotation.y = Math.PI / 3;
  teacherGroup.add(teacherRing2);

  // Speech / Question Screen
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 600;
  teacherScreenCtx = canvas.getContext('2d')!;
  teacherScreenTexture = new CanvasTexture(canvas);
  teacherScreenTexture.colorSpace = SRGBColorSpace;
  teacherScreenTexture.generateMipmaps = true;
  teacherScreenTexture.minFilter = LinearMipmapLinearFilter;
  teacherScreenTexture.magFilter = LinearFilter;

  const screenGeo = new BoxGeometry(0.50, 0.30, 0.012);
  const screenFaceMat = new MeshStandardMaterial({
    map: teacherScreenTexture,
    roughness: 0.3,
    metalness: 0.1,
  });
  const screenEdgeMat = new MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.6,
  });

  teacherScreenMesh = new Mesh(screenGeo, [
    screenEdgeMat,
    screenEdgeMat,
    screenEdgeMat,
    screenEdgeMat,
    screenFaceMat, // +Z
    screenEdgeMat,
  ]);
  teacherScreenMesh.position.set(0, -0.02, 0);
  // Angle slightly upwards to comfortably face seated user (at y=1.15)
  teacherScreenMesh.rotation.x = -0.10;
  teacherGroup.add(teacherScreenMesh);

  // Trigger Zone Visualizer (Holographic pulsing ring below teacher)
  const triggerGeo = new RingGeometry(0.16, 0.18, 48);
  const triggerMat = new MeshBasicMaterial({
    color: 0x38bdf8,
    side: DoubleSide,
    transparent: true,
    opacity: 0.45,
  });
  triggerRingMesh = new Mesh(triggerGeo, triggerMat);
  triggerRingMesh.rotation.x = -Math.PI / 2;
  triggerRingMesh.position.set(0, -0.16, 0.05);
  teacherGroup.add(triggerRingMesh);

  world.createTransformEntity(teacherGroup);
  renderTeacherScreen(null);
}

/** Create Know (Green) and Revise (Orange) zones */
export function createZones(world: World): void {
  const zoneWidth = 0.28; // 28 cm wide (> 20 cm)
  const zoneDepth = 0.24; // 24 cm deep
  const zoneHeight = 0.02; // 2 cm raised tray

  // 1. REVISE ZONE (Left, Orange)
  reviseZoneGroup = new Group();
  reviseZoneGroup.name = 'revise-zone';
  reviseZoneGroup.position.copy(REVISE_ZONE_POS);

  const reviseCanvas = document.createElement('canvas');
  reviseCanvas.width = 1024;
  reviseCanvas.height = 860;
  reviseZoneCtx = reviseCanvas.getContext('2d')!;
  reviseZoneTexture = new CanvasTexture(reviseCanvas);
  reviseZoneTexture.colorSpace = SRGBColorSpace;
  reviseZoneTexture.generateMipmaps = true;
  reviseZoneTexture.minFilter = LinearMipmapLinearFilter;
  reviseZoneTexture.magFilter = LinearFilter;

  const trayGeo = new BoxGeometry(zoneWidth, zoneHeight, zoneDepth);
  const reviseTopMat = new MeshStandardMaterial({
    map: reviseZoneTexture,
    roughness: 0.35,
    metalness: 0.1,
  });
  const reviseRimMat = new MeshStandardMaterial({
    color: 0xf97316,
    emissive: new Color('#f97316'),
    emissiveIntensity: 0.4,
    roughness: 0.4,
  });

  const reviseMesh = new Mesh(trayGeo, [
    reviseRimMat,
    reviseRimMat,
    reviseTopMat, // +Y
    reviseRimMat,
    reviseRimMat,
    reviseRimMat,
  ]);
  // Slight tilt facing seated user
  reviseMesh.rotation.x = -0.15;
  reviseMesh.rotation.y = 0.32;
  reviseZoneGroup.add(reviseMesh);

  // Floating 3D Badge for Revise
  const badgeCanvasR = document.createElement('canvas');
  badgeCanvasR.width = 512;
  badgeCanvasR.height = 140;
  reviseBadgeTexture = new CanvasTexture(badgeCanvasR);
  reviseBadgeTexture.colorSpace = SRGBColorSpace;

  const badgeGeoR = new BoxGeometry(0.18, 0.05, 0.005);
  const badgeMatR = new MeshStandardMaterial({
    map: reviseBadgeTexture,
    roughness: 0.3,
  });
  reviseBadgeMesh = new Mesh(badgeGeoR, badgeMatR);
  reviseBadgeMesh.position.set(0, 0.14, -0.05);
  reviseBadgeMesh.rotation.x = -0.15;
  reviseBadgeMesh.rotation.y = 0.32;
  reviseZoneGroup.add(reviseBadgeMesh);

  renderZoneSurface(reviseZoneCtx, reviseZoneTexture, 'revise', 0);
  renderBadge(reviseBadgeTexture, 'revise', 0);
  world.createTransformEntity(reviseZoneGroup);

  // 2. KNOW ZONE (Right, Green)
  knowZoneGroup = new Group();
  knowZoneGroup.name = 'know-zone';
  knowZoneGroup.position.copy(KNOW_ZONE_POS);

  const knowCanvas = document.createElement('canvas');
  knowCanvas.width = 1024;
  knowCanvas.height = 860;
  knowZoneCtx = knowCanvas.getContext('2d')!;
  knowZoneTexture = new CanvasTexture(knowCanvas);
  knowZoneTexture.colorSpace = SRGBColorSpace;
  knowZoneTexture.generateMipmaps = true;
  knowZoneTexture.minFilter = LinearMipmapLinearFilter;
  knowZoneTexture.magFilter = LinearFilter;

  const knowTopMat = new MeshStandardMaterial({
    map: knowZoneTexture,
    roughness: 0.35,
    metalness: 0.1,
  });
  const knowRimMat = new MeshStandardMaterial({
    color: 0x22c55e,
    emissive: new Color('#22c55e'),
    emissiveIntensity: 0.4,
    roughness: 0.4,
  });

  const knowMesh = new Mesh(trayGeo, [
    knowRimMat,
    knowRimMat,
    knowTopMat, // +Y
    knowRimMat,
    knowRimMat,
    knowRimMat,
  ]);
  knowMesh.rotation.x = -0.15;
  knowMesh.rotation.y = -0.32;
  knowZoneGroup.add(knowMesh);

  // Floating 3D Badge for Know
  const badgeCanvasK = document.createElement('canvas');
  badgeCanvasK.width = 512;
  badgeCanvasK.height = 140;
  knowBadgeTexture = new CanvasTexture(badgeCanvasK);
  knowBadgeTexture.colorSpace = SRGBColorSpace;

  const badgeGeoK = new BoxGeometry(0.18, 0.05, 0.005);
  knowBadgeMesh = new Mesh(badgeGeoK, [
    knowRimMat,
    knowRimMat,
    knowRimMat,
    knowRimMat,
    new MeshStandardMaterial({ map: knowBadgeTexture, roughness: 0.3 }),
    knowRimMat,
  ]);
  knowBadgeMesh.position.set(0, 0.14, -0.05);
  knowBadgeMesh.rotation.x = -0.15;
  knowBadgeMesh.rotation.y = -0.32;
  knowZoneGroup.add(knowBadgeMesh);

  renderZoneSurface(knowZoneCtx, knowZoneTexture, 'know', 0);
  renderBadge(knowBadgeTexture, 'know', 0);
  world.createTransformEntity(knowZoneGroup);
}

/** Snap a card into Know or Revise zone and lock it */
export function snapCardToZone(card: CardRecord, zone: 'know' | 'revise'): void {
  if (card.lockedZone) return;

  card.lockedZone = zone;
  const isKnow = zone === 'know';
  const targetZonePos = isKnow ? KNOW_ZONE_POS : REVISE_ZONE_POS;
  const stackIndex = isKnow ? studyBuddyState.knowCount : studyBuddyState.reviseCount;

  // Compute neat stack target position & rotation inside zone tray
  const targetPos = new Vector3(
    targetZonePos.x,
    targetZonePos.y + 0.022 + stackIndex * 0.008,
    targetZonePos.z
  );

  const targetRot = new Euler(
    -0.15,
    isKnow ? -0.32 : 0.32,
    0
  );

  // Start smooth snap animation
  card.isSnapping = true;
  card.snapTargetPos.copy(targetPos);
  card.snapTargetRot.copy(targetRot);
  card.snapProgress = 0;

  // Lock the card so it can no longer be picked up or hovered
  if (card.entity.hasComponent(DistanceGrabbable)) {
    card.entity.removeComponent(DistanceGrabbable);
  }
  if (card.entity.hasComponent(RayInteractable)) {
    card.entity.removeComponent(RayInteractable);
  }

  // Apply accent glow to indicate placement
  card.frontMaterial.emissive.set(isKnow ? 0x22c55e : 0xf97316);
  card.frontMaterial.emissiveIntensity = 0.4;

  // Increment counters
  if (isKnow) {
    studyBuddyState.knowCount++;
  } else {
    studyBuddyState.reviseCount++;
  }

  // Update displays
  if (knowZoneCtx && knowZoneTexture && knowBadgeTexture) {
    renderZoneSurface(knowZoneCtx, knowZoneTexture, 'know', studyBuddyState.knowCount);
    renderBadge(knowBadgeTexture, 'know', studyBuddyState.knowCount);
  }
  if (reviseZoneCtx && reviseZoneTexture && reviseBadgeTexture) {
    renderZoneSurface(reviseZoneCtx, reviseZoneTexture, 'revise', studyBuddyState.reviseCount);
    renderBadge(reviseBadgeTexture, 'revise', studyBuddyState.reviseCount);
  }

  const feedbackMsg = `✓ Sorted Card #${card.data.id} into ${zone.toUpperCase()}!`;
  studyBuddyState.lastSortedMessage = feedbackMsg;
  studyBuddyState.activeQuestionCard = null;
  renderTeacherScreen(null, feedbackMsg);
  updateHtmlCounters();
}

/** Check if a position is within the Know Zone horizontal volume */
export function isInsideKnowZone(pos: Vector3): boolean {
  return (
    Math.abs(pos.x - KNOW_ZONE_POS.x) <= ZONE_HALF_WIDTH &&
    Math.abs(pos.z - KNOW_ZONE_POS.z) <= ZONE_HALF_DEPTH &&
    pos.y >= 0.70 &&
    pos.y <= 1.12
  );
}

/** Check if a position is within the Revise Zone horizontal volume */
export function isInsideReviseZone(pos: Vector3): boolean {
  return (
    Math.abs(pos.x - REVISE_ZONE_POS.x) <= ZONE_HALF_WIDTH &&
    Math.abs(pos.z - REVISE_ZONE_POS.z) <= ZONE_HALF_DEPTH &&
    pos.y >= 0.70 &&
    pos.y <= 1.12
  );
}

/** Check if a position is within the Teacher Trigger Zone */
export function isInsideTeacherTrigger(pos: Vector3): boolean {
  return pos.distanceTo(TEACHER_TRIGGER_POS) <= TEACHER_TRIGGER_RADIUS;
}

/** Update HUD text in the HTML overlay */
function updateHtmlCounters(): void {
  const el = document.getElementById('hud-counters');
  if (el) {
    el.innerHTML = `Know: <strong style="color: #4ade80;">${studyBuddyState.knowCount}</strong> | Revise: <strong style="color: #fb923c;">${studyBuddyState.reviseCount}</strong>`;
  }
}

/** Resets all study session state, counters, teacher screen, and cards */
export function resetStudyBuddy(cards: CardRecord[]): void {
  studyBuddyState.knowCount = 0;
  studyBuddyState.reviseCount = 0;
  studyBuddyState.activeQuestionCard = null;
  studyBuddyState.lastSortedMessage = null;

  cards.forEach((card) => {
    card.lockedZone = null;
    card.isSnapping = false;
    card.hasBeenMoved = false;
    card.mesh.position.copy(card.initialPos);
    card.mesh.rotation.copy(card.initialRot);
    card.mesh.scale.set(1, 1, 1);
    card.frontMaterial.emissiveIntensity = 0;

    // Re-add interactable and grabbable if missing
    if (!card.entity.hasComponent(RayInteractable)) {
      card.entity.addComponent(RayInteractable);
    }
    if (!card.entity.hasComponent(DistanceGrabbable)) {
      card.entity.addComponent(DistanceGrabbable, {
        movementMode: MovementMode.MoveFromTarget,
        translate: true,
        rotate: true,
      });
    }
  });

  if (knowZoneCtx && knowZoneTexture && knowBadgeTexture) {
    renderZoneSurface(knowZoneCtx, knowZoneTexture, 'know', 0);
    renderBadge(knowBadgeTexture, 'know', 0);
  }
  if (reviseZoneCtx && reviseZoneTexture && reviseBadgeTexture) {
    renderZoneSurface(reviseZoneCtx, reviseZoneTexture, 'revise', 0);
    renderBadge(reviseBadgeTexture, 'revise', 0);
  }

  renderTeacherScreen(null);
  updateHtmlCounters();
}

const tempPos = new Vector3();

/** Frame loop update for Teacher animations and trigger detection */
export function updateStudyBuddy(
  delta: number,
  time: number,
  cards: CardRecord[]
): void {
  // 1. Idle animation for Teacher avatar
  if (teacherOrb && teacherRing1 && teacherRing2) {
    teacherRing1.rotation.x += delta * 0.9;
    teacherRing1.rotation.y += delta * 0.6;
    teacherRing2.rotation.y += delta * 0.8;
    teacherRing2.rotation.z += delta * 0.5;

    // Gentle floating bobbing
    teacherOrb.position.y = 0.22 + Math.sin(time * 2.2) * 0.012;
    teacherRing1.position.y = teacherOrb.position.y;
    teacherRing2.position.y = teacherOrb.position.y;
  }

  if (triggerRingMesh) {
    // Pulse trigger zone visualizer
    const pulse = 0.35 + Math.sin(time * 3) * 0.15;
    (triggerRingMesh.material as MeshBasicMaterial).opacity = pulse;
  }

  // 2. Check Teacher Trigger zone proximity
  let detectedCard: FlashcardData | null = null;
  let minDistance = TEACHER_TRIGGER_RADIUS;

  for (const card of cards) {
    // Ignore cards that are already locked into Know or Revise
    if (card.lockedZone) continue;

    card.mesh.getWorldPosition(tempPos);
    const dist = tempPos.distanceTo(TEACHER_TRIGGER_POS);
    if (dist <= minDistance) {
      minDistance = dist;
      detectedCard = card.data;
    }
  }

  if (detectedCard !== null) {
    if (detectedCard !== studyBuddyState.activeQuestionCard) {
      studyBuddyState.activeQuestionCard = detectedCard;
      studyBuddyState.lastSortedMessage = null;
      renderTeacherScreen(detectedCard);
    }
  } else if (studyBuddyState.activeQuestionCard !== null) {
    // Card was removed from trigger zone without snapping
    studyBuddyState.activeQuestionCard = null;
    renderTeacherScreen(null, studyBuddyState.lastSortedMessage ?? undefined);
  }
}
