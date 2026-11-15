import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Dimensions,
} from 'react-native';
import Svg, {
  Polygon,
  Polyline,
  Circle,
  Line,
  Defs,
  RadialGradient,
  Stop,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import { MuscleSubGroupId } from '../types/workout';
import { MuscleRankStat } from '../services/muscleAnalytics';
import { RANK_TIERS } from '../data/muscleMap';
import { RankBadge } from './RankBadge';

export type ModelColorMode = 'priority' | 'ranks';

interface MuscleModel3DProps {
  muscleStats: Record<MuscleSubGroupId, MuscleRankStat>;
  selectedMuscle: MuscleSubGroupId | null;
  onSelectMuscle: (muscleId: MuscleSubGroupId) => void;
  colorMode: ModelColorMode;
  onChangeColorMode: (mode: ModelColorMode) => void;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface MeshFace3D {
  id: string;
  muscleId?: MuscleSubGroupId;
  vertices: [Vec3, Vec3, Vec3, Vec3] | [Vec3, Vec3, Vec3];
  isStructural?: boolean;
}

interface MuscleCentroid3D {
  muscleId: MuscleSubGroupId;
  pos: Vec3;
  normalZSign: number; // +1 front, -1 back, 0 side
}

// Helper to parse hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
  );
}

function shadeColor3D(baseHex: string, brightness: number, rimBoost: number = 0): string {
  const { r, g, b } = hexToRgb(baseHex);
  const bFactor = Math.max(0.28, Math.min(1.45, brightness));
  const rim = Math.max(0, Math.min(80, rimBoost * 55));
  return rgbToHex(r * bFactor + rim, g * bFactor + rim, b * bFactor + rim);
}

/**
 * Generates a 3D lofted anatomical segment between elliptical cross-section rings.
 * Allows tagging specific angular sectors (front, back, outer, inner) with distinct MuscleSubGroupIds.
 */
function buildLoftedSegment(params: {
  idPrefix: string;
  rings: {
    y: number;
    cx: number;
    cz: number;
    rx: number;
    rz: number;
  }[];
  steps?: number;
  sectorMuscle?: (angleRad: number, ringIdx: number) => MuscleSubGroupId | undefined;
  mirrorX?: boolean;
}): MeshFace3D[] {
  const { idPrefix, rings, steps = 10, sectorMuscle, mirrorX = false } = params;
  const faces: MeshFace3D[] = [];
  const signs = mirrorX ? [1, -1] : [1];

  for (const signX of signs) {
    for (let r = 0; r < rings.length - 1; r++) {
      const r0 = rings[r];
      const r1 = rings[r + 1];

      for (let s = 0; s < steps; s++) {
        const a0 = (s / steps) * Math.PI * 2;
        const a1 = ((s + 1) / steps) * Math.PI * 2;
        const aMid = (a0 + a1) * 0.5;

        const p00: Vec3 = {
          x: signX * (r0.cx + Math.cos(a0) * r0.rx),
          y: r0.y,
          z: r0.cz + Math.sin(a0) * r0.rz,
        };
        const p01: Vec3 = {
          x: signX * (r0.cx + Math.cos(a1) * r0.rx),
          y: r0.y,
          z: r0.cz + Math.sin(a1) * r0.rz,
        };
        const p11: Vec3 = {
          x: signX * (r1.cx + Math.cos(a1) * r1.rx),
          y: r1.y,
          z: r1.cz + Math.sin(a1) * r1.rz,
        };
        const p10: Vec3 = {
          x: signX * (r1.cx + Math.cos(a0) * r1.rx),
          y: r1.y,
          z: r1.cz + Math.sin(a0) * r1.rz,
        };

        const mId = sectorMuscle ? sectorMuscle(aMid, r) : undefined;
        faces.push({
          id: `${idPrefix}_${signX > 0 ? 'R' : 'L'}_${r}_${s}`,
          muscleId: mId,
          isStructural: !mId,
          vertices: signX > 0 ? [p00, p01, p11, p10] : [p01, p00, p10, p11],
        });
      }
    }
  }

  return faces;
}

/**
 * Generates a sculpted 3D muscle belly pod on the surface of the body (left & right mirrored).
 */
function buildSculptedMusclePod(params: {
  idPrefix: string;
  muscleId: MuscleSubGroupId;
  cx: number;
  cy: number;
  cz: number;
  rx: number;
  ry: number;
  rz: number;
  tiltZ?: number;
  tiltX?: number;
  mirrorX?: boolean;
}): MeshFace3D[] {
  const {
    idPrefix,
    muscleId,
    cx,
    cy,
    cz,
    rx,
    ry,
    rz,
    tiltZ = 0,
    tiltX = 0,
    mirrorX = true,
  } = params;

  const profileRings = [
    { t: -1.0, scale: 0.25 },
    { t: -0.55, scale: 0.82 },
    { t: 0.0, scale: 1.0 },
    { t: 0.55, scale: 0.82 },
    { t: 1.0, scale: 0.25 },
  ];

  const steps = 8;
  const faces: MeshFace3D[] = [];
  const signs = mirrorX ? [1, -1] : [1];

  const cosZ = Math.cos(tiltZ);
  const sinZ = Math.sin(tiltZ);
  const cosX = Math.cos(tiltX);
  const sinX = Math.sin(tiltX);

  for (const signX of signs) {
    const transformPt = (lx: number, ly: number, lz: number): Vec3 => {
      // Rotate in local XY (tiltZ) and YZ (tiltX)
      const x1 = lx * cosZ - ly * sinZ;
      const y1 = lx * sinZ + ly * cosZ;
      const y2 = y1 * cosX - lz * sinX;
      const z2 = y1 * sinX + lz * cosX;
      return {
        x: signX * (cx + x1),
        y: cy + y2,
        z: cz + z2,
      };
    };

    for (let r = 0; r < profileRings.length - 1; r++) {
      const pr0 = profileRings[r];
      const pr1 = profileRings[r + 1];

      for (let s = 0; s < steps; s++) {
        const a0 = (s / steps) * Math.PI * 2;
        const a1 = ((s + 1) / steps) * Math.PI * 2;

        const p00 = transformPt(
          Math.cos(a0) * rx * pr0.scale,
          pr0.t * ry,
          Math.sin(a0) * rz * pr0.scale
        );
        const p01 = transformPt(
          Math.cos(a1) * rx * pr0.scale,
          pr0.t * ry,
          Math.sin(a1) * rz * pr0.scale
        );
        const p11 = transformPt(
          Math.cos(a1) * rx * pr1.scale,
          pr1.t * ry,
          Math.sin(a1) * rz * pr1.scale
        );
        const p10 = transformPt(
          Math.cos(a0) * rx * pr1.scale,
          pr1.t * ry,
          Math.sin(a0) * rz * pr1.scale
        );

        faces.push({
          id: `${idPrefix}_${signX > 0 ? 'R' : 'L'}_${r}_${s}`,
          muscleId,
          vertices: signX > 0 ? [p00, p01, p11, p10] : [p01, p00, p10, p11],
        });
      }
    }
  }

  return faces;
}

/**
 * Builds the complete 3D anatomical human mesh with all 19 muscle sub-groups.
 * Coordinate space: Y in [-1.55 (feet) .. +1.50 (head)], X in [-0.75 .. +0.75], Z in [-0.30 .. +0.30].
 */
function buildAnatomicalHumanMesh(): {
  faces: MeshFace3D[];
  centroids: MuscleCentroid3D[];
} {
  const faces: MeshFace3D[] = [];

  // 1. HEAD & NECK (structural obsidian titanium)
  faces.push(
    ...buildLoftedSegment({
      idPrefix: 'head_neck',
      steps: 10,
      rings: [
        { y: 1.50, cx: 0, cz: 0.01, rx: 0.09, rz: 0.11 }, // Crown
        { y: 1.40, cx: 0, cz: 0.02, rx: 0.125, rz: 0.145 }, // Cranium
        { y: 1.27, cx: 0, cz: 0.02, rx: 0.11, rz: 0.13 }, // Cheekbones
        { y: 1.16, cx: 0, cz: 0.01, rx: 0.08, rz: 0.095 }, // Jaw
        { y: 1.04, cx: 0, cz: -0.01, rx: 0.085, rz: 0.085 }, // Neck
      ],
    })
  );

  // 2. TORSO CORE (with anatomical sector mapping for chest, abs, obliques, lats, mid_back, lower_back)
  faces.push(
    ...buildLoftedSegment({
      idPrefix: 'torso',
      steps: 16,
      rings: [
        { y: 1.03, cx: 0, cz: -0.01, rx: 0.19, rz: 0.11 }, // Collar / Traps base
        { y: 0.90, cx: 0, cz: 0.0, rx: 0.34, rz: 0.175 }, // Upper chest / Scapula
        { y: 0.72, cx: 0, cz: 0.01, rx: 0.32, rz: 0.185 }, // Mid chest / Lats flare
        { y: 0.52, cx: 0, cz: 0.0, rx: 0.265, rz: 0.155 }, // Upper waist / Ribcage
        { y: 0.32, cx: 0, cz: -0.005, rx: 0.235, rz: 0.14 }, // Mid waist / Umbilicus
        { y: 0.12, cx: 0, cz: -0.01, rx: 0.255, rz: 0.155 }, // Pelvis top / Hip bone
        { y: -0.05, cx: 0, cz: -0.02, rx: 0.24, rz: 0.165 }, // Pelvis base
      ],
      sectorMuscle: (angle, rIdx) => {
        // angle in [0..2PI]: sin(a) > 0 is FRONT (+Z), sin(a) < 0 is BACK (-Z)
        const sinA = Math.sin(angle);
        const cosA = Math.cos(angle);
        const absCos = Math.abs(cosA);

        if (rIdx === 0) {
          // Collar / Traps
          if (sinA < 0.35) return 'traps';
          return 'upper_chest';
        }
        if (rIdx === 1) {
          // Upper chest & Mid-back / Lats
          if (sinA >= 0.25) return 'upper_chest';
          if (absCos > 0.78) return 'lats';
          return 'mid_back';
        }
        if (rIdx === 2) {
          // Mid-lower chest & Lats
          if (sinA >= 0.3) return 'mid_lower_chest';
          if (absCos > 0.65) return 'lats';
          return 'mid_back';
        }
        if (rIdx === 3) {
          // Upper abs, obliques, lats/lower_back
          if (sinA >= 0.48) return 'abs';
          if (sinA >= -0.15 && absCos >= 0.65) return 'obliques';
          if (absCos > 0.72) return 'lats';
          return 'lower_back';
        }
        if (rIdx === 4) {
          // Lower abs, obliques, lower_back
          if (sinA >= 0.45) return 'abs';
          if (sinA >= -0.2 && absCos >= 0.6) return 'obliques';
          return 'lower_back';
        }
        // Pelvis / Glutes top
        if (sinA < -0.2) return 'glutes';
        if (sinA > 0.5) return 'abs';
        return undefined;
      },
    })
  );

  // 3. SCULPTED 3D MUSCLE PODS ON TORSO (adds realistic 3D anatomical relief!)
  // Upper Pectorals
  faces.push(
    ...buildSculptedMusclePod({
      idPrefix: 'pod_upper_chest',
      muscleId: 'upper_chest',
      cx: 0.14,
      cy: 0.87,
      cz: 0.155,
      rx: 0.135,
      ry: 0.075,
      rz: 0.06,
      tiltZ: 0.18,
      mirrorX: true,
    })
  );

  // Mid/Lower Pectoral Plates
  faces.push(
    ...buildSculptedMusclePod({
      idPrefix: 'pod_mid_chest',
      muscleId: 'mid_lower_chest',
      cx: 0.145,
      cy: 0.73,
      cz: 0.175,
      rx: 0.145,
      ry: 0.095,
      rz: 0.07,
      tiltZ: -0.06,
      mirrorX: true,
    })
  );

  // Traps Hood (Left & Right)
  faces.push(
    ...buildSculptedMusclePod({
      idPrefix: 'pod_traps',
      muscleId: 'traps',
      cx: 0.14,
      cy: 0.98,
      cz: -0.05,
      rx: 0.13,
      ry: 0.08,
      rz: 0.085,
      tiltZ: -0.35,
      mirrorX: true,
    })
  );

  // Latissimus Wings
  faces.push(
    ...buildSculptedMusclePod({
      idPrefix: 'pod_lats',
      muscleId: 'lats',
      cx: 0.25,
      cy: 0.64,
      cz: -0.10,
      rx: 0.095,
      ry: 0.21,
      rz: 0.09,
      tiltZ: -0.22,
      mirrorX: true,
    })
  );

  // Mid-Back Rhomboids / Lower Traps
  faces.push(
    ...buildSculptedMusclePod({
      idPrefix: 'pod_mid_back',
      muscleId: 'mid_back',
      cx: 0.11,
      cy: 0.76,
      cz: -0.165,
      rx: 0.11,
      ry: 0.16,
      rz: 0.065,
      tiltZ: 0.08,
      mirrorX: true,
    })
  );

  // Lower Back Erectors
  faces.push(
    ...buildSculptedMusclePod({
      idPrefix: 'pod_lower_back',
      muscleId: 'lower_back',
      cx: 0.085,
      cy: 0.36,
      cz: -0.145,
      rx: 0.075,
      ry: 0.19,
      rz: 0.06,
      mirrorX: true,
    })
  );

  // 6-Pack Abs Blocks (3 rows x 2 columns)
  for (const rowY of [0.54, 0.41, 0.28]) {
    faces.push(
      ...buildSculptedMusclePod({
        idPrefix: `pod_abs_${Math.round(rowY * 100)}`,
        muscleId: 'abs',
        cx: 0.065,
        cy: rowY,
        cz: 0.155,
        rx: 0.062,
        ry: 0.058,
        rz: 0.045,
        mirrorX: true,
      })
    );
  }

  // Obliques Side Panels
  faces.push(
    ...buildSculptedMusclePod({
      idPrefix: 'pod_obliques',
      muscleId: 'obliques',
      cx: 0.215,
      cy: 0.39,
      cz: 0.05,
      rx: 0.065,
      ry: 0.17,
      rz: 0.095,
      tiltZ: 0.12,
      mirrorX: true,
    })
  );

  // 4. DELTOIDS (3 distinct heads: front_delts, side_delts, rear_delts)
  faces.push(
    ...buildSculptedMusclePod({
      idPrefix: 'pod_front_delt',
      muscleId: 'front_delts',
      cx: 0.36,
      cy: 0.86,
      cz: 0.085,
      rx: 0.085,
      ry: 0.11,
      rz: 0.085,
      tiltZ: 0.25,
      mirrorX: true,
    }),
    ...buildSculptedMusclePod({
      idPrefix: 'pod_side_delt',
      muscleId: 'side_delts',
      cx: 0.425,
      cy: 0.86,
      cz: 0.0,
      rx: 0.085,
      ry: 0.12,
      rz: 0.095,
      tiltZ: 0.15,
      mirrorX: true,
    }),
    ...buildSculptedMusclePod({
      idPrefix: 'pod_rear_delt',
      muscleId: 'rear_delts',
      cx: 0.36,
      cy: 0.86,
      cz: -0.085,
      rx: 0.085,
      ry: 0.105,
      rz: 0.085,
      tiltZ: -0.25,
      mirrorX: true,
    })
  );

  // 5. UPPER ARMS (Biceps front + Triceps back) & FOREARMS
  faces.push(
    ...buildLoftedSegment({
      idPrefix: 'upper_arm',
      steps: 10,
      mirrorX: true,
      rings: [
        { y: 0.78, cx: 0.43, cz: -0.01, rx: 0.095, rz: 0.095 },
        { y: 0.62, cx: 0.46, cz: -0.01, rx: 0.10, rz: 0.105 },
        { y: 0.45, cx: 0.48, cz: 0.0, rx: 0.082, rz: 0.082 },
      ],
      sectorMuscle: (angle) => {
        return Math.sin(angle) >= 0 ? 'biceps' : 'triceps';
      },
    }),
    // Extra Biceps Peak & Triceps Horseshoe relief
    ...buildSculptedMusclePod({
      idPrefix: 'pod_biceps',
      muscleId: 'biceps',
      cx: 0.455,
      cy: 0.62,
      cz: 0.065,
      rx: 0.075,
      ry: 0.135,
      rz: 0.07,
      tiltZ: -0.08,
      mirrorX: true,
    }),
    ...buildSculptedMusclePod({
      idPrefix: 'pod_triceps',
      muscleId: 'triceps',
      cx: 0.46,
      cy: 0.64,
      cz: -0.075,
      rx: 0.082,
      ry: 0.145,
      rz: 0.075,
      tiltZ: 0.08,
      mirrorX: true,
    }),
    // Forearms
    ...buildLoftedSegment({
      idPrefix: 'forearm',
      steps: 10,
      mirrorX: true,
      rings: [
        { y: 0.44, cx: 0.485, cz: 0.005, rx: 0.078, rz: 0.078 },
        { y: 0.32, cx: 0.51, cz: 0.02, rx: 0.082, rz: 0.075 },
        { y: 0.17, cx: 0.535, cz: 0.035, rx: 0.062, rz: 0.055 },
        { y: 0.05, cx: 0.55, cz: 0.045, rx: 0.048, rz: 0.042 },
      ],
      sectorMuscle: (_angle, rIdx) => (rIdx < 2 ? 'forearms' : undefined),
    })
  );

  // 6. GLUTES
  faces.push(
    ...buildSculptedMusclePod({
      idPrefix: 'pod_glutes',
      muscleId: 'glutes',
      cx: 0.135,
      cy: -0.02,
      cz: -0.145,
      rx: 0.135,
      ry: 0.145,
      rz: 0.11,
      mirrorX: true,
    })
  );

  // 7. THIGHS (Quads front/outer, Adductors inner, Hamstrings back)
  faces.push(
    ...buildLoftedSegment({
      idPrefix: 'thigh',
      steps: 12,
      mirrorX: true,
      rings: [
        { y: -0.06, cx: 0.155, cz: -0.01, rx: 0.145, rz: 0.155 },
        { y: -0.26, cx: 0.16, cz: 0.0, rx: 0.15, rz: 0.15 },
        { y: -0.48, cx: 0.155, cz: 0.0, rx: 0.13, rz: 0.13 },
        { y: -0.68, cx: 0.15, cz: -0.005, rx: 0.10, rz: 0.10 }, // Knee
      ],
      sectorMuscle: (angle, rIdx) => {
        if (rIdx >= 2 && Math.abs(Math.sin(angle)) < 0.25) return undefined; // Knee joint
        const sinA = Math.sin(angle);
        const cosA = Math.cos(angle);
        // Inner thigh (cosA < -0.45 in local mirrored coords where +X is outer)
        if (cosA < -0.42 && sinA > -0.35 && rIdx <= 1) {
          return 'adductors';
        }
        if (sinA >= -0.05) {
          return 'quads';
        }
        return 'hamstrings';
      },
    }),
    // Sculpted Quad Sweep & Hamstring Belly
    ...buildSculptedMusclePod({
      idPrefix: 'pod_quads',
      muscleId: 'quads',
      cx: 0.17,
      cy: -0.34,
      cz: 0.105,
      rx: 0.115,
      ry: 0.24,
      rz: 0.09,
      mirrorX: true,
    }),
    ...buildSculptedMusclePod({
      idPrefix: 'pod_adductors',
      muscleId: 'adductors',
      cx: 0.065,
      cy: -0.25,
      cz: 0.035,
      rx: 0.068,
      ry: 0.16,
      rz: 0.08,
      mirrorX: true,
    }),
    ...buildSculptedMusclePod({
      idPrefix: 'pod_hamstrings',
      muscleId: 'hamstrings',
      cx: 0.155,
      cy: -0.36,
      cz: -0.105,
      rx: 0.10,
      ry: 0.23,
      rz: 0.085,
      mirrorX: true,
    })
  );

  // 8. CALVES & LOWER LEGS
  faces.push(
    ...buildLoftedSegment({
      idPrefix: 'lower_leg',
      steps: 10,
      mirrorX: true,
      rings: [
        { y: -0.70, cx: 0.15, cz: -0.01, rx: 0.092, rz: 0.092 },
        { y: -0.90, cx: 0.155, cz: -0.025, rx: 0.105, rz: 0.115 }, // Calf peak
        { y: -1.14, cx: 0.15, cz: -0.015, rx: 0.075, rz: 0.08 },
        { y: -1.38, cx: 0.145, cz: -0.01, rx: 0.058, rz: 0.065 }, // Ankle
        { y: -1.48, cx: 0.15, cz: 0.05, rx: 0.07, rz: 0.12 }, // Foot
      ],
      sectorMuscle: (angle, rIdx) => {
        if (rIdx <= 1 && Math.sin(angle) < 0.45) return 'calves';
        return undefined;
      },
    }),
    ...buildSculptedMusclePod({
      idPrefix: 'pod_calves',
      muscleId: 'calves',
      cx: 0.155,
      cy: -0.92,
      cz: -0.085,
      rx: 0.088,
      ry: 0.16,
      rz: 0.08,
      mirrorX: true,
    })
  );

  // 3D Centroids for each of the 19 muscles (for HUD callout lines & hit-testing)
  const centroids: MuscleCentroid3D[] = [
    { muscleId: 'upper_chest', pos: { x: 0.14, y: 0.88, z: 0.19 }, normalZSign: 1 },
    { muscleId: 'mid_lower_chest', pos: { x: -0.15, y: 0.73, z: 0.21 }, normalZSign: 1 },
    { muscleId: 'front_delts', pos: { x: 0.37, y: 0.86, z: 0.13 }, normalZSign: 1 },
    { muscleId: 'side_delts', pos: { x: -0.46, y: 0.86, z: 0.0 }, normalZSign: 0 },
    { muscleId: 'rear_delts', pos: { x: 0.37, y: 0.86, z: -0.13 }, normalZSign: -1 },
    { muscleId: 'biceps', pos: { x: -0.46, y: 0.62, z: 0.10 }, normalZSign: 1 },
    { muscleId: 'triceps', pos: { x: -0.46, y: 0.64, z: -0.11 }, normalZSign: -1 },
    { muscleId: 'forearms', pos: { x: 0.52, y: 0.29, z: 0.05 }, normalZSign: 0 },
    { muscleId: 'traps', pos: { x: 0.14, y: 1.00, z: -0.08 }, normalZSign: -1 },
    { muscleId: 'lats', pos: { x: -0.27, y: 0.64, z: -0.14 }, normalZSign: -1 },
    { muscleId: 'mid_back', pos: { x: 0.11, y: 0.76, z: -0.20 }, normalZSign: -1 },
    { muscleId: 'lower_back', pos: { x: -0.09, y: 0.36, z: -0.18 }, normalZSign: -1 },
    { muscleId: 'abs', pos: { x: 0.0, y: 0.42, z: 0.19 }, normalZSign: 1 },
    { muscleId: 'obliques', pos: { x: 0.23, y: 0.39, z: 0.09 }, normalZSign: 1 },
    { muscleId: 'quads', pos: { x: -0.17, y: -0.34, z: 0.15 }, normalZSign: 1 },
    { muscleId: 'adductors', pos: { x: 0.07, y: -0.25, z: 0.08 }, normalZSign: 1 },
    { muscleId: 'hamstrings', pos: { x: -0.16, y: -0.36, z: -0.15 }, normalZSign: -1 },
    { muscleId: 'glutes', pos: { x: 0.14, y: -0.02, z: -0.19 }, normalZSign: -1 },
    { muscleId: 'calves', pos: { x: 0.16, y: -0.92, z: -0.13 }, normalZSign: -1 },
  ];

  return { faces, centroids };
}

const STATIC_MESH = buildAnatomicalHumanMesh();

export const MuscleModel3D: React.FC<MuscleModel3DProps> = ({
  muscleStats,
  selectedMuscle,
  onSelectMuscle,
  colorMode,
  onChangeColorMode,
}) => {
  const { theme } = useAppTheme();

  // 3D Camera Angles (yaw = horizontal 360 rotation, pitch = vertical tilt)
  const [yaw, setYaw] = useState<number>(0.22);
  const [pitch, setPitch] = useState<number>(0.08);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1.0);

  const yawRef = useRef(yaw);
  const pitchRef = useRef(pitch);
  yawRef.current = yaw;
  pitchRef.current = pitch;

  const dragStartRef = useRef({ yaw: 0, pitch: 0, moved: false });
  const targetYawRef = useRef<number | null>(null);

  // Smooth turntable animation & camera tweening
  useEffect(() => {
    let frameId: number;
    let lastTime = Date.now();

    const tick = () => {
      const now = Date.now();
      const dt = Math.min(64, now - lastTime) / 1000;
      lastTime = now;

      if (targetYawRef.current !== null) {
        const current = yawRef.current;
        const target = targetYawRef.current;
        // Shortest angular distance
        let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (diff < -Math.PI) diff += Math.PI * 2;

        if (Math.abs(diff) < 0.015) {
          setYaw(target);
          targetYawRef.current = null;
        } else {
          setYaw(current + diff * Math.min(1, dt * 8.5));
        }
      } else if (autoRotate) {
        setYaw((prev) => (prev + dt * 0.42) % (Math.PI * 2));
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [autoRotate]);

  // Rotate camera smoothly when selectedMuscle changes externally
  useEffect(() => {
    if (!selectedMuscle) return;
    const stat = muscleStats[selectedMuscle];
    if (stat) {
      setAutoRotate(false);
      targetYawRef.current = stat.meta.cameraYaw;
    }
  }, [selectedMuscle, muscleStats]);

  const screenWidth = Dimensions.get('window').width;
  const svgWidth = Math.max(280, screenWidth - 42);
  const svgHeight = 410;
  const centerX = svgWidth * 0.5;
  const centerY = svgHeight * 0.50;
  const baseScale = 118 * zoom;
  const cameraDist = 4.8;

  const project3D = useCallback(
    (v: Vec3, cosY: number, sinY: number, cosX: number, sinX: number) => {
      // Rotate around Y (yaw)
      const x1 = v.x * cosY + v.z * sinY;
      const z1 = -v.x * sinY + v.z * cosY;
      // Rotate around X (pitch)
      const y2 = v.y * cosX - z1 * sinX;
      const z2 = v.y * sinX + z1 * cosX;

      const persp = cameraDist / Math.max(1.5, cameraDist - z2);
      return {
        sx: centerX + x1 * baseScale * persp,
        sy: centerY - y2 * baseScale * persp,
        z: z2,
        x3: x1,
        y3: y2,
      };
    },
    [centerX, centerY, baseScale]
  );

  // Determine base color for each muscle according to colorMode
  const getMuscleBaseColor = useCallback(
    (mId: MuscleSubGroupId): { hex: string; isPriority: boolean; isSelected: boolean } => {
      const stat = muscleStats[mId];
      const isSelected = selectedMuscle === mId;

      if (!stat) {
        return { hex: '#3F3F46', isPriority: false, isSelected };
      }

      if (colorMode === 'ranks') {
        return {
          hex: stat.rankMeta.color,
          isPriority: false,
          isSelected,
        };
      }

      // Priority / Relative Balance mode ("Co teraz robić")
      switch (stat.priorityStatus) {
        case 'neglected':
          return { hex: '#F43F5E', isPriority: true, isSelected }; // Crimson alert - train next!
        case 'lagging':
          return { hex: '#F59E0B', isPriority: true, isSelected }; // Amber - needs work
        case 'dominant':
          return { hex: '#38BDF8', isPriority: false, isSelected }; // Electric cyan - dominant
        case 'balanced':
        default:
          return { hex: '#10B981', isPriority: false, isSelected }; // Emerald - balanced
      }
    },
    [muscleStats, selectedMuscle, colorMode]
  );

  // Project and sort all 3D faces + centroids for the current frame
  const renderedScene = useMemo(() => {
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosX = Math.cos(pitch);
    const sinX = Math.sin(pitch);

    const projectedFaces: {
      id: string;
      muscleId?: MuscleSubGroupId;
      pointsStr: string;
      fill: string;
      stroke: string;
      strokeWidth: number;
      zDepth: number;
      cx2d: number;
      cy2d: number;
    }[] = [];

    for (const face of STATIC_MESH.faces) {
      const pts = face.vertices.map((v) => project3D(v, cosY, sinY, cosX, sinX));

      // Compute 3D normal in camera space
      const ax = pts[1].x3 - pts[0].x3;
      const ay = pts[1].y3 - pts[0].y3;
      const az = pts[1].z - pts[0].z;
      const bx = pts[2].x3 - pts[0].x3;
      const by = pts[2].y3 - pts[0].y3;
      const bz = pts[2].z - pts[0].z;

      let nx = ay * bz - az * by;
      let ny = az * bx - ax * bz;
      let nz = ax * by - ay * bx;
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= nLen;
      ny /= nLen;
      nz /= nLen;

      // Back-face culling (keep slightly past grazing angle so silhouette stays watertight)
      if (nz < -0.18) continue;

      const avgZ = pts.reduce((acc, p) => acc + p.z, 0) / pts.length;
      const cx2d = pts.reduce((acc, p) => acc + p.sx, 0) / pts.length;
      const cy2d = pts.reduce((acc, p) => acc + p.sy, 0) / pts.length;

      // Lighting calculation (Key light + Fill light + Rim light)
      const keyDot = Math.max(0, nx * 0.38 + ny * 0.45 + Math.abs(nz) * 0.81);
      const fillDot = Math.max(0, -nx * 0.4 + ny * 0.3 + Math.abs(nz) * 0.5);
      const rim = Math.pow(1 - Math.min(1, Math.abs(nz)), 1.8);
      const brightness = 0.34 + keyDot * 0.62 + fillDot * 0.18;

      let fill = '#1E1E24';
      let stroke = '#2A2A32';
      let strokeWidth = 0.45;

      if (face.muscleId) {
        const mColor = getMuscleBaseColor(face.muscleId);
        const selBoost = mColor.isSelected ? 0.32 : 0;
        fill = shadeColor3D(mColor.hex, brightness + selBoost, rim + (mColor.isSelected ? 0.4 : 0));
        stroke = mColor.isSelected
          ? '#FFFFFF'
          : shadeColor3D(mColor.hex, brightness * 0.72, 0.15);
        strokeWidth = mColor.isSelected ? 1.15 : 0.55;
      } else {
        // Structural titanium mesh (head, neck, joints, hands, feet)
        fill = shadeColor3D('#27272F', brightness * 0.9, rim * 0.35);
        stroke = 'rgba(255,255,255,0.08)';
        strokeWidth = 0.4;
      }

      projectedFaces.push({
        id: face.id,
        muscleId: face.muscleId,
        pointsStr: pts.map((p) => `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(' '),
        fill,
        stroke,
        strokeWidth,
        zDepth: avgZ,
        cx2d,
        cy2d,
      });
    }

    // Painter's algorithm: sort back-to-front by Z
    projectedFaces.sort((a, b) => a.zDepth - b.zDepth);

    // 3D Floor Pedestal Rings
    const buildFloorRing = (radius: number, yLevel: number, segs: number = 36) => {
      const ringPts: string[] = [];
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const p = project3D(
          { x: Math.cos(a) * radius, y: yLevel, z: Math.sin(a) * radius },
          cosY,
          sinY,
          cosX,
          sinX
        );
        ringPts.push(`${p.sx.toFixed(1)},${p.sy.toFixed(1)}`);
      }
      return ringPts.join(' ');
    };

    const outerFloorRing = buildFloorRing(0.76, -1.52);
    const innerFloorRing = buildFloorRing(0.50, -1.52);
    const frontFloorMarker = project3D({ x: 0, y: -1.52, z: 0.88 }, cosY, sinY, cosX, sinX);
    const backFloorMarker = project3D({ x: 0, y: -1.52, z: -0.88 }, cosY, sinY, cosX, sinX);

    // Project muscle centroids for HUD callouts & touch hit-testing
    const projectedCentroids = STATIC_MESH.centroids.map((c) => {
      const p = project3D(c.pos, cosY, sinY, cosX, sinX);
      // Determine if this muscle faces the camera currently
      const rotatedNormalZ = -c.pos.x * sinY + c.pos.z * cosY;
      const isFacingCamera = c.normalZSign === 0 ? true : rotatedNormalZ > -0.02;
      return {
        muscleId: c.muscleId,
        sx: p.sx,
        sy: p.sy,
        z: p.z,
        isFacingCamera,
      };
    });

    return {
      projectedFaces,
      outerFloorRing,
      innerFloorRing,
      frontFloorMarker,
      backFloorMarker,
      projectedCentroids,
    };
  }, [yaw, pitch, project3D, getMuscleBaseColor]);

  // Handle tap hit-testing in 3D screen space
  const handleTapCanvas = useCallback(
    (tapX: number, tapY: number) => {
      // First check front-most polygon hit within 24px
      let bestMuscle: MuscleSubGroupId | null = null;
      let bestScore = Infinity;

      for (let i = renderedScene.projectedFaces.length - 1; i >= 0; i--) {
        const f = renderedScene.projectedFaces[i];
        if (!f.muscleId) continue;
        const dx = f.cx2d - tapX;
        const dy = f.cy2d - tapY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Prefer faces closer to the camera & closer to the tap
        const score = dist - f.zDepth * 18;
        if (dist < 34 && score < bestScore) {
          bestScore = score;
          bestMuscle = f.muscleId;
        }
      }

      if (bestMuscle) {
        try {
          Haptics.selectionAsync();
        } catch {}
        onSelectMuscle(bestMuscle);
      }
    },
    [renderedScene.projectedFaces, onSelectMuscle]
  );

  const handleTapRef = useRef(handleTapCanvas);
  handleTapRef.current = handleTapCanvas;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        targetYawRef.current = null;
        dragStartRef.current = {
          yaw: yawRef.current,
          pitch: pitchRef.current,
          moved: false,
        };
      },
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5) {
          dragStartRef.current.moved = true;
          setAutoRotate(false);
        }
        const nextYaw = dragStartRef.current.yaw + gestureState.dx * 0.014;
        const nextPitch = Math.max(
          -0.38,
          Math.min(0.38, dragStartRef.current.pitch + gestureState.dy * 0.006)
        );
        setYaw(nextYaw);
        setPitch(nextPitch);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (
          !dragStartRef.current.moved &&
          Math.abs(gestureState.dx) < 6 &&
          Math.abs(gestureState.dy) < 6
        ) {
          handleTapRef.current(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
        }
      },
    })
  ).current;

  const snapToAngle = (targetYaw: number) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setAutoRotate(false);
    setPitch(0.08);
    targetYawRef.current = targetYaw;
  };

  // Active callouts on the 3D viewport (selected muscle + top visible priority muscle)
  const hudCallouts = useMemo(() => {
    const list: {
      muscleId: MuscleSubGroupId;
      sx: number;
      sy: number;
      stat: MuscleRankStat;
      side: 'left' | 'right';
    }[] = [];

    const candidates = renderedScene.projectedCentroids.filter((c) => c.isFacingCamera);

    if (selectedMuscle) {
      const found =
        candidates.find((c) => c.muscleId === selectedMuscle) ||
        renderedScene.projectedCentroids.find((c) => c.muscleId === selectedMuscle);
      if (found && muscleStats[found.muscleId]) {
        list.push({
          muscleId: found.muscleId,
          sx: found.sx,
          sy: found.sy,
          stat: muscleStats[found.muscleId],
          side: found.sx < centerX ? 'left' : 'right',
        });
      }
    } else {
      // Show up to 2 highest-priority facing muscles
      const sortedFacing = [...candidates]
        .filter((c) => muscleStats[c.muscleId])
        .sort(
          (a, b) =>
            (muscleStats[b.muscleId]?.priorityScore || 0) -
            (muscleStats[a.muscleId]?.priorityScore || 0)
        )
        .slice(0, 2);

      sortedFacing.forEach((c, idx) => {
        list.push({
          muscleId: c.muscleId,
          sx: c.sx,
          sy: c.sy,
          stat: muscleStats[c.muscleId],
          side: idx === 0 ? 'left' : 'right',
        });
      });
    }

    return list;
  }, [renderedScene.projectedCentroids, selectedMuscle, muscleStats, centerX]);

  const selectedStat = selectedMuscle ? muscleStats[selectedMuscle] : null;
  const normalizedDeg = Math.round((((yaw * 180) / Math.PI) % 360 + 360) % 360);

  return (
    <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
      {/* Top Mode & Camera Header */}
      <View style={styles.topRow}>
        <View>
          <View style={styles.liveTagRow}>
            <View style={styles.liveDot} />
            <Text style={[styles.kicker, { color: theme.textMuted }]}>
              ANATOMIA 3D • {normalizedDeg}°
            </Text>
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Mapa Rozwoju Mięśni</Text>
        </View>

        {/* Color Mode Toggle: Priority vs Ranks */}
        <View style={[styles.modePillGroup, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.modePill,
              colorMode === 'priority' && { backgroundColor: theme.primary },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              onChangeColorMode('priority');
            }}
            activeOpacity={0.75}
          >
            <Ionicons
              name="locate-outline"
              size={13}
              color={colorMode === 'priority' ? theme.primaryText : theme.textMuted}
            />
            <Text
              style={[
                styles.modePillText,
                { color: colorMode === 'priority' ? theme.primaryText : theme.textMuted },
              ]}
            >
              Priorytet
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modePill,
              colorMode === 'ranks' && { backgroundColor: theme.primary },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              onChangeColorMode('ranks');
            }}
            activeOpacity={0.75}
          >
            <Ionicons
              name="ribbon-outline"
              size={13}
              color={colorMode === 'ranks' ? theme.primaryText : theme.textMuted}
              style={{ display: 'none' }}
            />
            <Text
              style={[
                styles.modePillText,
                { color: colorMode === 'ranks' ? theme.primaryText : theme.textMuted },
              ]}
            >
              Rangi F-S+
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Interactive 3D Viewport */}
      <View
        style={[styles.viewportBox, { backgroundColor: '#070709', borderColor: theme.border }]}
        {...panResponder.panHandlers}
      >
        <Svg width={svgWidth} height={svgHeight}>
          <Defs>
            <RadialGradient id="studioGlow" cx="50%" cy="46%" r="52%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.09" />
              <Stop offset="55%" stopColor="#38BDF8" stopOpacity="0.03" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Subtle Studio Spotlight */}
          <Rect x={0} y={0} width={svgWidth} height={svgHeight} fill="url(#studioGlow)" />

          {/* 3D Rotating Telemetry Pedestal Rings */}
          <Polyline
            points={renderedScene.outerFloorRing}
            fill="none"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth={1.2}
            strokeDasharray="5,5"
          />
          <Polyline
            points={renderedScene.innerFloorRing}
            fill="none"
            stroke="rgba(56,189,248,0.28)"
            strokeWidth={1.5}
          />

          {/* 3D Floor Orientation Markers (PRZÓD / TYŁ) */}
          <SvgText
            x={renderedScene.frontFloorMarker.sx}
            y={renderedScene.frontFloorMarker.sy}
            fill="rgba(255,255,255,0.45)"
            fontSize={9}
            fontWeight="800"
            textAnchor="middle"
          >
            PRZÓD
          </SvgText>
          <SvgText
            x={renderedScene.backFloorMarker.sx}
            y={renderedScene.backFloorMarker.sy}
            fill="rgba(255,255,255,0.28)"
            fontSize={9}
            fontWeight="800"
            textAnchor="middle"
          >
            TYŁ
          </SvgText>

          {/* 3D Sorted Anatomical Muscle & Body Mesh Faces */}
          {renderedScene.projectedFaces.map((f) => (
            <Polygon
              key={f.id}
              points={f.pointsStr}
              fill={f.fill}
              stroke={f.stroke}
              strokeWidth={f.strokeWidth}
              strokeLinejoin="round"
            />
          ))}

          {/* 3D HUD Callout Leader Lines */}
          {hudCallouts.map((c) => {
            const targetX = c.side === 'left' ? 18 : svgWidth - 18;
            const targetY = Math.max(54, Math.min(svgHeight - 75, c.sy - 14));
            const color =
              colorMode === 'priority'
                ? c.stat.priorityStatus === 'neglected'
                  ? '#F43F5E'
                  : c.stat.priorityStatus === 'lagging'
                  ? '#F59E0B'
                  : '#38BDF8'
                : c.stat.rankMeta.color;

            return (
              <React.Fragment key={`callout_${c.muscleId}`}>
                <Line
                  x1={c.sx}
                  y1={c.sy}
                  x2={targetX}
                  y2={targetY}
                  stroke={color}
                  strokeWidth={1.4}
                  strokeDasharray="3,3"
                />
                <Circle cx={c.sx} cy={c.sy} r={4.5} fill={color} stroke="#000" strokeWidth={1.5} />
              </React.Fragment>
            );
          })}
        </Svg>

        {/* Floating HUD Callout Badges */}
        {hudCallouts.map((c) => {
          const topPos = Math.max(36, Math.min(svgHeight - 86, c.sy - 32));
          const isNeglected = c.stat.priorityStatus === 'neglected';
          return (
            <TouchableOpacity
              key={`hud_badge_${c.muscleId}`}
              style={[
                styles.hudCalloutCard,
                c.side === 'left' ? { left: 10 } : { right: 10 },
                {
                  top: topPos,
                  borderColor: isNeglected ? '#F43F5E' : c.stat.rankMeta.badgeBorder,
                  backgroundColor: 'rgba(10, 10, 14, 0.90)',
                },
              ]}
              onPress={() => onSelectMuscle(c.muscleId)}
              activeOpacity={0.85}
            >
              <View style={styles.hudCalloutTop}>
                <Text style={styles.hudCalloutTitle} numberOfLines={1}>
                  {c.stat.meta.shortLabel}
                </Text>
                <View
                  style={[
                    styles.hudMiniRank,
                    {
                      backgroundColor: c.stat.rankMeta.badgeBg,
                      borderColor: c.stat.rankMeta.badgeBorder,
                    },
                  ]}
                >
                  <Text style={[styles.hudMiniRankText, { color: c.stat.rankMeta.color }]}>
                    {c.stat.rank}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.hudCalloutSub,
                  { color: isNeglected ? '#FDA4AF' : '#A1A1AA' },
                ]}
                numberOfLines={1}
              >
                {colorMode === 'priority'
                  ? c.stat.statusLabel
                  : `${c.stat.effectiveSetsTotal} serii • ${c.stat.progressPct}%`}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Top-Left Gesture Hint */}
        <View style={styles.gestureHintPill} pointerEvents="none">
          <Ionicons name="sync-outline" size={12} color="#A1A1AA" />
          <Text style={styles.gestureHintText}>Przeciągnij 360° • Dotknij mięśnia</Text>
        </View>

        {/* Bottom Camera Controls Overlay */}
        <View style={styles.cameraControlsBar}>
          <TouchableOpacity
            style={[styles.camBtn, Math.abs(Math.sin(yaw)) < 0.35 && Math.cos(yaw) > 0 && styles.camBtnActive]}
            onPress={() => snapToAngle(0)}
          >
            <Text style={styles.camBtnText}>Przód</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.camBtn, Math.abs(Math.cos(yaw)) < 0.45 && styles.camBtnActive]}
            onPress={() => snapToAngle(Math.PI * 0.5)}
          >
            <Text style={styles.camBtnText}>Bok</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.camBtn, Math.cos(yaw) < -0.7 && styles.camBtnActive]}
            onPress={() => snapToAngle(Math.PI)}
          >
            <Text style={styles.camBtnText}>Tył</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.camBtn, autoRotate && styles.camBtnActive]}
            onPress={() => {
              Haptics.selectionAsync();
              targetYawRef.current = null;
              setAutoRotate((prev) => !prev);
            }}
          >
            <Ionicons
              name={autoRotate ? 'pause' : 'play'}
              size={11}
              color="#FFFFFF"
            />
            <Text style={styles.camBtnText}>360°</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.camBtn}
            onPress={() => {
              Haptics.selectionAsync();
              setZoom((prev) => (prev >= 1.2 ? 1.0 : 1.22));
            }}
          >
            <Ionicons
              name={zoom > 1.05 ? 'contract-outline' : 'expand-outline'}
              size={12}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Color Legend Strip */}
      {colorMode === 'priority' ? (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F43F5E' }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>
              Priorytet (Odstaje)
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Do dopracowania</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>W normie</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#38BDF8' }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Dominująca</Text>
          </View>
        </View>
      ) : (
        <View style={styles.legendRow}>
          {RANK_TIERS.map((r) => (
            <View key={r.tier} style={styles.rankLegendChip}>
              <View style={[styles.legendDot, { backgroundColor: r.color }]} />
              <Text style={[styles.legendText, { color: r.color, fontWeight: '800' }]}>
                {r.tier}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Selected Muscle Inspector Drawer inside the 3D Card */}
      {selectedStat ? (
        <View style={[styles.inspectorBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.inspectorHeader}>
            <RankBadge tier={selectedStat.rank} size="lg" progressPct={selectedStat.progressPct} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.inspectorTitleRow}>
                <Text style={[styles.inspectorTitle, { color: theme.text }]}>
                  {selectedStat.meta.label}
                </Text>
                <Text style={[styles.inspectorStatusTag, { color: selectedStat.rankMeta.color }]}>
                  {selectedStat.rankMeta.title}
                </Text>
              </View>
              <Text style={[styles.inspectorDesc, { color: theme.textMuted }]}>
                {selectedStat.meta.description}
              </Text>
            </View>
          </View>

          <View style={[styles.inspectorMetricsRow, { borderColor: theme.hairline }]}>
            <View style={styles.inspectorMetric}>
              <Text style={[styles.inspectorMetricVal, { color: theme.text }]}>
                {selectedStat.effectiveSetsTotal}
              </Text>
              <Text style={[styles.inspectorMetricLbl, { color: theme.textMuted }]}>
                Serii łącznie
              </Text>
            </View>
            <View style={styles.inspectorMetric}>
              <Text style={[styles.inspectorMetricVal, { color: theme.text }]}>
                {selectedStat.effectiveSets30d}
              </Text>
              <Text style={[styles.inspectorMetricLbl, { color: theme.textMuted }]}>
                Ostatnie 30 dni
              </Text>
            </View>
            <View style={styles.inspectorMetric}>
              <Text style={[styles.inspectorMetricVal, { color: theme.text }]}>
                {selectedStat.nextTier ? `${selectedStat.setsToNext} serii` : 'MAX'}
              </Text>
              <Text style={[styles.inspectorMetricLbl, { color: theme.textMuted }]}>
                {selectedStat.nextTier ? `Do rangi ${selectedStat.nextTier}` : 'Szczyt S+'}
              </Text>
            </View>
          </View>

          <View style={styles.inspectorTipRow}>
            <Ionicons name="flash" size={14} color={selectedStat.rankMeta.color} />
            <Text style={[styles.inspectorTipText, { color: theme.textSecondary }]}>
              {selectedStat.recommendationText}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  liveTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  modePillGroup: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 2,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  modePillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  viewportBox: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gestureHintPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(18, 18, 22, 0.78)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  gestureHintText: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '700',
  },
  hudCalloutCard: {
    position: 'absolute',
    width: 118,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  hudCalloutTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  hudCalloutTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    flex: 1,
  },
  hudMiniRank: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  hudMiniRankText: {
    fontSize: 10,
    fontWeight: '900',
  },
  hudCalloutSub: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  cameraControlsBar: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 15, 18, 0.88)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  camBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  camBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  camBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 4,
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rankLegendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  inspectorBox: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
  },
  inspectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inspectorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  inspectorTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  inspectorStatusTag: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  inspectorDesc: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  inspectorMetricsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginTop: 11,
    paddingVertical: 9,
    justifyContent: 'space-around',
  },
  inspectorMetric: {
    alignItems: 'center',
  },
  inspectorMetricVal: {
    fontSize: 14,
    fontWeight: '900',
  },
  inspectorMetricLbl: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  inspectorTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
  },
  inspectorTipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
});
