import { useLayoutEffect, useRef, useState } from 'react';

type Direction = 'water' | 'tools';
type Segment = 'approach' | Direction | 'depot' | 'idle';

interface SceneProps {
  segment: Segment;
  progress: number;
  direction: Direction;
  switchOpen: boolean;
  water: number;
  tools: number;
  loadingCargo?: Direction | null;
}

const approach = 'M338 421 V330';
const waterIn = 'M338 330 C338 290 205 310 205 243 V209';
const toolsIn = 'M338 330 C338 290 481 310 481 243 V209';
const waterOut = 'M205 209 V180 C205 126 338 153 338 108';
const toolsOut = 'M481 209 V180 C481 126 338 153 338 108';
const returnRail = 'M338 108 C338 59 635 61 693 101 C763 148 780 271 734 338 C675 424 507 439 338 421';
const depot = 'M338 421 C281 418 266 388 212 388 H133';
const routeOut = returnRail.replace('M338 108 ', '');
const railPaths = [
  'M338 493 V421', approach, waterIn, toolsIn, waterOut, toolsOut, returnRail, depot,
];
const motionPaths = {
  approach, waterIn, toolsIn, waterOut: `${waterOut} ${routeOut}`, toolsOut: `${toolsOut} ${routeOut}`, depot,
};
type MotionPath = keyof typeof motionPaths;

const trees: Array<[number, number, number, string]> = [
  [78, 171, 1.1, '#359a75'], [110, 205, .8, '#6ca34b'], [67, 246, .86, '#39896e'],
  [105, 333, 1.2, '#4d9d6c'], [60, 350, .76, '#6eae64'], [286, 191, .64, '#79ad63'],
  [377, 181, .68, '#459b77'], [398, 212, .9, '#409f76'], [272, 371, .75, '#4c9f71'],
  [606, 152, 1.1, '#5a9e6a'], [655, 174, .78, '#74b166'], [686, 217, .83, '#38967a'],
  [803, 211, 1.18, '#58aa76'], [832, 260, .8, '#7dae61'], [801, 319, .88, '#389479'],
  [631, 348, 1.02, '#45a075'], [595, 369, .8, '#78af67'], [754, 418, 1.15, '#66a95f'],
  [817, 399, .75, '#4a9a71'], [461, 373, .72, '#77ad61'], [493, 381, .9, '#4c9d6c'],
];

function Station({ x, color, pale, name, kind }: { x: number; color: string; pale: string; name: string; kind: Direction }) {
  return <g transform={`translate(${x},218)`}>
    <ellipse cy="36" rx="59" ry="15" fill="#205d50" opacity=".16"/>
    <rect x="-50" y="6" width="100" height="33" rx="12" fill="#e9c78f" stroke="#a47b58" strokeWidth="2"/>
    <path d="M-47 29 H47" stroke="#fff4cc" strokeWidth="3" strokeDasharray="7 4"/>
    <path d="M-40 18 V-17 H40 V18 Z" fill={pale} stroke={color} strokeWidth="2.5"/>
    <path d="M-50 -15 L-36 -35 H36 L50 -15 Z" fill={color} stroke="#264b53" strokeWidth="2"/>
    <path d="M-36 -31 H36" stroke="#fff8d9" strokeWidth="3" opacity=".55"/>
    <rect x="-27" y="-7" width="54" height="23" rx="7" fill="#fff9e9"/>
    <text textAnchor="middle" y="9" fill="#1b4852" fontSize="16" fontWeight="800">{name}</text>
    {kind === 'water'
      ? <path d="M0 -28 C-9 -18 -7 -11 0 -11 S9 -18 0 -28Z" transform="translate(0,-12)" fill="#b9ecff"/>
      : <path d="M-9 -21 H9 V-9 H-9 Z M-4 -21 V-25 H4 V-21" transform="translate(0,-14)" fill="#fff1bd" stroke="#87533e" strokeWidth="2"/>}
  </g>;
}

export function TrainRewardScene({ segment, progress, direction, switchOpen, water, tools, loadingCargo }: SceneProps) {
  const paths = useRef<Partial<Record<MotionPath, SVGPathElement | null>>>({});
  const lengths = useRef<Partial<Record<MotionPath, number>>>({});
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    for (const key of Object.keys(motionPaths) as MotionPath[]) {
      lengths.current[key] = paths.current[key]?.getTotalLength();
    }
    setReady(true);
  }, []);

  const p = Math.min(1, Math.max(0, progress));
  let key: MotionPath = 'approach';
  let local = p;
  if (segment === 'idle') local = 0;
  else if (segment === 'depot') key = 'depot';
  else if (segment === 'water' || segment === 'tools') {
    key = p <= .45 ? `${segment}In` : `${segment}Out`;
    local = p <= .45 ? p / .45 : (p - .45) / .55;
  }
  const path = paths.current[key];
  const length = lengths.current[key] ?? 0;
  const point = ready && path ? path.getPointAtLength(length * local) : { x: 338, y: 421 };
  const before = ready && path ? path.getPointAtLength(Math.max(0, length * local - 2)) : { x: 338, y: 422 };
  const after = ready && path ? path.getPointAtLength(Math.min(length, length * local + 2)) : { x: 338, y: 420 };
  const angle = Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI;
  const cargo = [...Array.from({ length: water }, () => '#66d8ef'), ...Array.from({ length: tools }, () => '#f7bb61')];

  return <svg className="train-board" viewBox="0 0 880 506" role="img" aria-label={`莲花山玩具轨道，已装${water}箱水和${tools}箱工具`}>
    <defs>
      <linearGradient id="train-land" x2=".18" y2="1">
        <stop stopColor="#c6e6a7"/><stop offset="1" stopColor="#8ccf97"/>
      </linearGradient>
      <linearGradient id="train-hill" x2=".9" y2="1">
        <stop stopColor="#e5efaa"/><stop offset="1" stopColor="#a5d78d"/>
      </linearGradient>
      <linearGradient id="train-pond" x2="1" y2="1">
        <stop stopColor="#86e6ec"/><stop offset="1" stopColor="#48b8ca"/>
      </linearGradient>
      <pattern id="train-grass" width="38" height="34" patternUnits="userSpaceOnUse">
        <path d="M6 14 l3 2 3-5 M26 24 l2 3 4-4" fill="none" stroke="#689761" strokeWidth="1.1" opacity=".27"/>
        <circle cx="21" cy="7" r="1.5" fill="#eaf4b7" opacity=".65"/>
      </pattern>
      <symbol id="train-tree" viewBox="-29 -40 58 58">
        <ellipse cy="13" rx="27" ry="7" fill="#235d52" opacity=".16"/>
        <path d="M-3 -16 V12 H4 V-16Z" fill="#906748"/>
        <path d="M-19 0 Q-34 -11 -19 -22 Q-20 -37 -5 -37 Q6 -45 17 -32 Q30 -29 25 -18 Q34 -4 17 1 Q-1 8 -19 0Z" fill="currentColor" stroke="#417b5a" strokeWidth="1.4"/>
        <path d="M-16 -23 Q-13 -34 -3 -31 Q1 -38 9 -32" fill="none" stroke="#e6efab" strokeWidth="3" opacity=".5" strokeLinecap="round"/>
        <path d="M-20 -6 Q-3 8 17 -2" fill="none" stroke="#285d49" strokeWidth="3" opacity=".18"/>
      </symbol>
    </defs>

    <rect width="880" height="506" fill="url(#train-land)"/>
    <path d="M0 106 Q122 9 227 47 T458 36 Q655 -31 880 69 V0 H0Z" fill="#93d2a3"/>
    <path d="M0 105 Q108 21 228 60 Q354 79 466 43 T880 86 V112 Q761 60 622 92 T359 117 Q151 65 0 145Z" fill="url(#train-hill)"/>
    <path d="M0 383 Q124 310 229 403 Q296 466 430 454 Q647 421 880 448 V506 H0Z" fill="#a6d887"/>
    <rect width="880" height="506" fill="url(#train-grass)"/>
    <path d="M5 121 Q80 85 147 115 M711 75 Q768 65 867 107 M638 457 Q776 432 874 465" fill="none" stroke="#f2f5c0" strokeWidth="3" opacity=".72"/>

    <path d="M44 252 Q54 214 105 220 Q167 216 168 259 Q168 296 126 313 Q74 325 50 295 Q33 276 44 252Z" fill="#d3e6a3" stroke="#83ab73" strokeWidth="4"/>
    <path d="M50 253 Q60 224 107 227 Q156 224 160 257 Q159 286 124 303 Q81 314 57 291 Q43 274 50 253Z" fill="url(#train-pond)"/>
    <path d="M59 257 q14 -5 30 0 m31 11 q12 -4 27 0 m-76 24 q13 -4 30 0" stroke="#c6f7e7" strokeWidth="2" opacity=".8" fill="none" strokeLinecap="round"/>
    {[{ x: 92, y: 252 }, { x: 126, y: 283 }, { x: 77, y: 281 }].map(({ x, y }) => <g key={x} transform={`translate(${x},${y})`}>
      <path d="M-11 3 Q-13 -5 -2 -4 Q12 -6 12 3 Q5 11 -11 3Z" fill="#4eaa79"/>
      <path d="M0 1 Q-11 -2 -6 -8 Q-2 -10 0 -5 Q2 -12 6 -8 Q11 -4 0 1Z" fill="#f5a7c5"/>
      <circle cy="-2" r="2" fill="#fff0af"/>
    </g>)}

    {trees.map(([x, y, scale, color]) => <use key={x} href="#train-tree" x={x - 29 * scale} y={y - 40 * scale}
      width={58 * scale} height={58 * scale} style={{ color }}/>)}
    <g fill="#fff3b5">
      <circle cx="147" cy="152" r="3"/><circle cx="153" cy="157" r="2"/><circle cx="141" cy="157" r="2.5"/>
      <circle cx="549" cy="214" r="3"/><circle cx="555" cy="218" r="2"/><circle cx="543" cy="217" r="2.5"/>
      <circle cx="577" cy="340" r="3"/><circle cx="585" cy="344" r="2"/><circle cx="570" cy="345" r="2.5"/>
      <circle cx="390" cy="379" r="2.5"/><circle cx="396" cy="383" r="2"/>
      <circle cx="779" cy="363" r="3"/><circle cx="785" cy="368" r="2"/>
    </g>

    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {railPaths.map((d, i) => <path key={i} d={d} stroke="#426c53" opacity=".24" strokeWidth="27" transform="translate(0,5)"/>)}
      {railPaths.map((d, i) => <path key={i} d={d} stroke="#b38a66" strokeWidth="21"/>)}
      {railPaths.map((d, i) => <path key={i} d={d} stroke="#785b48" strokeWidth="19" strokeDasharray="1 9"/>)}
      {railPaths.map((d, i) => <path key={i} d={d} stroke="#385767" strokeWidth="12"/>)}
      {railPaths.map((d, i) => <path key={i} d={d} stroke="#a7c0c0" strokeWidth="8"/>)}
      {railPaths.map((d, i) => <path key={i} d={d} stroke="#77786d" strokeWidth="4"/>)}
      {(switchOpen || segment === 'water' || segment === 'tools') && <path d={direction === 'water' ? waterIn : toolsIn}
        stroke={direction === 'water' ? '#64e4ff' : '#ffe67b'} opacity=".8" strokeWidth="4" strokeDasharray="5 9"/>}
    </g>

    <g transform="translate(124,387)">
      <ellipse rx="61" ry="35" fill="#3b7660" opacity=".2"/>
      <path d="M-40 22 V-25 L0 -52 L40 -25 V22Z" fill="#f5cc96" stroke="#4c6962" strokeWidth="3"/>
      <path d="M-48 -21 L0 -58 L48 -21 L39 -15 L0 -45 L-39 -15Z" fill="#d56e62" stroke="#755f58" strokeWidth="2"/>
      <path d="M-19 23 V0 Q0 -22 19 0 V23Z" fill="#3f6a6d"/>
      <rect x="-25" y="-27" width="50" height="18" rx="6" fill="#fff1ce"/>
      <text y="-14" textAnchor="middle" fontSize="12" fontWeight="800" fill="#2d5b61">回库线</text>
    </g>
    <Station x={205} color="#25859f" pale="#d5f4f3" name="水站" kind="water"/>
    <Station x={481} color="#ba754d" pale="#fce5b4" name="工具站" kind="tools"/>

    <g transform="translate(383,326)">
      <ellipse cy="23" rx="13" ry="4" fill="#255b4c" opacity=".26"/>
      <path d="M0 2 V23" stroke="#53686c" strokeWidth="5" strokeLinecap="round"/>
      <rect x="-13" y="-17" width="26" height="25" rx="8" fill="#315864" stroke="#edf4ca" strokeWidth="2"/>
      <circle cy="-4" r="7" fill={switchOpen ? '#ffdf70' : '#789ba0'}/>
      {switchOpen && <circle cy="-4" r="11" fill="none" stroke="#fff0ad" strokeWidth="2"/>}
    </g>
    <g transform="translate(546,300)">
      <rect x="-38" y="-18" width="110" height="38" rx="12" fill="#f5edc8" stroke="#b9ce94" strokeWidth="2"/>
      <path d="M-31 -5 H-19 M-25 -11 V1" stroke="#d3946c" strokeWidth="2" strokeLinecap="round"/>
      <text x="20" y="6" textAnchor="middle" fontSize="15" fontWeight="800" fill="#456c60">莲花山环线</text>
    </g>

    <g transform={`translate(${point.x},${point.y}) rotate(${angle})`}>
      <ellipse cx="-20" cy="5" rx="56" ry="16" fill="#183d4c" opacity=".25"/>
      <path d="M-38 1 H-24" stroke="#294b53" strokeWidth="5" strokeLinecap="round"/>
      <rect x="-71" y="-12" width="42" height="24" rx="7" fill="#527d8a" stroke="#244858" strokeWidth="2"/>
      <rect x="-68" y="-9" width="35" height="18" rx="5" fill="#d5e9d2"/>
      {cargo.map((color, i) => <rect key={i} x={-67 + (i % 3) * 10} y={-8 + Math.floor(i / 3) * 8} width="9" height="7"
        rx="2" fill={color} stroke="#4c7380" strokeWidth=".8"/>)}
      <rect x="-25" y="-13" width="53" height="26" rx="9" fill="#f4a65a" stroke="#284b59" strokeWidth="2.5"/>
      <rect x="-22" y="-10" width="18" height="20" rx="5" fill="#236a7a" stroke="#23505d" strokeWidth="1.5"/>
      <rect x="-18" y="-7" width="11" height="14" rx="3" fill="#b9e6ee"/>
      <path d="M2 -9 H18 M2 8 H18" stroke="#ffdb98" strokeWidth="2.4" strokeLinecap="round"/>
      <circle cx="18" cy="0" r="5" fill="#d28157" stroke="#a85d43" strokeWidth="1"/>
      <rect x="25" y="-6" width="6" height="12" rx="2.5" fill="#fff1ad"/>
      {[-61, -38, -16, 18].map(x => <g key={x} fill="#284959">
        <rect x={x - 4} y="-15" width="8" height="5" rx="2"/>
        <rect x={x - 4} y="10" width="8" height="5" rx="2"/>
      </g>)}
    </g>

    {loadingCargo && <g transform={`translate(${loadingCargo === 'water' ? 205 : 481},150)`}>
      <path d="M-49 -15 Q-49 -23 -40 -23 H40 Q49 -23 49 -15 V7 Q49 15 40 15 H9 L0 22 L-9 15 H-40 Q-49 15 -49 7Z"
        fill={loadingCargo === 'water' ? '#def7ff' : '#fff0bd'} stroke={loadingCargo === 'water' ? '#297594' : '#a26836'} strokeWidth="2.5"/>
      <text y="3" textAnchor="middle" fill="#21444e" fontSize="16" fontWeight="900">{loadingCargo === 'water' ? '+1 箱水' : '+1 箱工具'}</text>
    </g>}

    <g opacity="0" pointerEvents="none">
      {(Object.entries(motionPaths) as Array<[MotionPath, string]>).map(([id, d]) =>
        <path key={id} d={d} fill="none" ref={element => { paths.current[id] = element; }}/>)}
    </g>
  </svg>;
}
