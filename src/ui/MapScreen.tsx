import { useEffect, useRef } from 'preact/hooks';
import * as R from '../engine/run';
import type { MapNodeType } from '../engine/types';
import { ACTS } from '../data';
import { act, useStore } from './store';

export const NODE_ICON: Record<MapNodeType, string> = {
  fight: '⚔️', elite: '😈', event: '❓', rest: '🔥', shop: '💰', treasure: '📦', boss: '👑',
};
const NODE_NAME: Record<MapNodeType, string> = {
  fight: '战斗', elite: '精英', event: '未知', rest: '休息', shop: '商店', treasure: '宝箱', boss: 'Boss',
};

const ROW_H = 64;
const PAD = 56;

function jitter(id: string, k: number) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (((h >> k) & 0xff) / 255 - 0.5);
}

export function MapScreen() {
  const s = useStore();
  const run = s.run!;
  const ref = useRef<HTMLDivElement>(null);
  const W = 360;
  const H = (R.MAP_ROWS + 1) * ROW_H + PAD * 2;
  const pos = (id: string) => {
    const n = run.map.nodes[id];
    if (n.type === 'boss') return { x: W / 2, y: PAD };
    return {
      x: ((n.c + 0.5) / R.MAP_COLS) * W + jitter(id, 3) * 18,
      y: H - PAD - n.r * ROW_H + jitter(id, 11) * 14,
    };
  };
  const avail = new Set(R.availableNodes(run));
  const visited = new Set(run.path);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cur = run.pos ? pos(run.pos).y : H;
    el.scrollTop = Math.max(0, cur - el.clientHeight * 0.65);
  }, [run.pos, run.act]);

  const nodes = Object.values(run.map.nodes);
  return (
    <div class="map-screen">
      <div class="map-title">第 {run.act} 层 · {ACTS[run.act - 1]?.name}</div>
      <div class="map-scroll" ref={ref}>
        <div class="map-canvas" style={{ height: H + 'px', width: W + 'px' }}>
          <svg width={W} height={H} class="map-lines">
            {nodes.flatMap((n) => n.next.map((t) => {
              const a = pos(n.id), b = pos(t);
              const walked = visited.has(n.id) && visited.has(t);
              return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} class={walked ? 'walked' : ''} />;
            }))}
          </svg>
          {nodes.map((n) => {
            const p = pos(n.id);
            const cls = [
              'map-node', `node-${n.type}`,
              avail.has(n.id) ? 'avail' : '',
              visited.has(n.id) ? 'visited' : '',
              run.pos === n.id ? 'current' : '',
            ].join(' ');
            return (
              <button class={cls} style={{ left: p.x + 'px', top: p.y + 'px' }}
                disabled={!avail.has(n.id)} onClick={() => act((r) => R.chooseNode(r, n.id))}>
                {NODE_ICON[n.type]}
              </button>
            );
          })}
        </div>
      </div>
      <div class="map-legend">
        {(Object.keys(NODE_ICON) as MapNodeType[]).map((k) => <span>{NODE_ICON[k]}{NODE_NAME[k]}</span>)}
      </div>
    </div>
  );
}
