import { Instance, Instances } from '@react-three/drei';
import { useMemo } from 'react';
import { doorTrims, inwardSign, windowParts, type Box3 } from '../domain/scene3d';
import type { Apartment } from '../domain/types';

const FRAME_COLOR = '#eceeed';
const SILL_COLOR = '#f4f4f1';
const TRIM_COLOR = '#c9b394';
const GLASS_COLOR = '#d6ebf3';

function BoxInstances({ boxes, color, name }: { boxes: Box3[]; color: string; name: string }) {
  if (boxes.length === 0) return null;
  return (
    <Instances key={boxes.length} limit={boxes.length} castShadow receiveShadow name={name}>
      <boxGeometry />
      <meshStandardMaterial color={color} roughness={0.55} />
      {boxes.map((b, i) => (
        <Instance key={i} position={b.position} rotation={[0, b.rotationY, 0]} scale={b.size} />
      ))}
    </Instances>
  );
}

/**
 * Окна (стекло, рама, подоконник внутрь квартиры) и дверные наличники.
 * В режиме «срез стен» окна и двери выше среза не рисуются.
 */
export function Openings({ apartment, cut }: { apartment: Apartment; cut: boolean }) {
  const parts = useMemo(() => {
    const glass: Box3[] = [];
    const frame: Box3[] = [];
    const sill: Box3[] = [];
    const trims: Box3[] = [];
    apartment.openings.forEach((o) => {
      const w = apartment.walls[o.wallIndex];
      if (!w) return;
      if (o.kind === 'window') {
        const p = windowParts(w, o, inwardSign(w, apartment.outline));
        sill.push(p.sill);
        if (!cut) {
          glass.push(p.glass);
          frame.push(...p.frame);
        }
      } else if (!cut) {
        trims.push(...doorTrims(w, o));
      }
    });
    return { glass, frame, sill, trims };
  }, [apartment, cut]);

  return (
    <group name="openings">
      <BoxInstances boxes={parts.frame} color={FRAME_COLOR} name="window-frames" />
      <BoxInstances boxes={parts.sill} color={SILL_COLOR} name="window-sills" />
      <BoxInstances boxes={parts.trims} color={TRIM_COLOR} name="door-trims" />
      {parts.glass.length > 0 && (
        <Instances key={parts.glass.length} limit={parts.glass.length} name="glass">
          <boxGeometry />
          <meshPhysicalMaterial
            color={GLASS_COLOR}
            transmission={0.92}
            thickness={0.02}
            roughness={0.05}
            ior={1.5}
            transparent
            opacity={0.6}
          />
          {parts.glass.map((b, i) => (
            <Instance key={i} position={b.position} rotation={[0, b.rotationY, 0]} scale={b.size} />
          ))}
        </Instances>
      )}
    </group>
  );
}
