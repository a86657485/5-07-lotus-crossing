import React from 'react';

// Start / End Terminal Stadium
export const FlowTerminal: React.FC<{ label: string; className?: string }> = ({ label, className = '' }) => (
  <div className={`px-4 py-1.5 rounded-full border-2 border-slate-400 bg-slate-100 text-slate-800 text-xs font-bold text-center shadow-sm select-none ${className}`}>
    {label}
  </div>
);

// Process Rectangle
export const FlowProcess: React.FC<{
  label: string;
  highlight?: boolean;
  className?: string;
  onClick?: () => void;
}> = ({ label, highlight, className = '', onClick }) => (
  <div
    onClick={onClick}
    className={`px-4 py-2.5 rounded-lg border-2 text-xs font-semibold text-center select-none transition-all ${
      highlight
        ? 'border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-400/50 shadow-md scale-[1.02]'
        : 'border-slate-300 bg-white text-slate-800 shadow-sm'
    } ${onClick ? 'cursor-pointer hover:border-amber-400' : ''} ${className}`}
  >
    {label}
  </div>
);

// Decision Diamond
export const FlowDecision: React.FC<{
  label: string;
  highlight?: boolean;
  className?: string;
  onClick?: () => void;
}> = ({ label, highlight, className = '', onClick }) => (
  <div
    onClick={onClick}
    className={`relative w-36 h-20 flex items-center justify-center p-2 text-center text-xs font-bold select-none transition-all ${
      onClick ? 'cursor-pointer' : ''
    } ${className}`}
  >
    <svg className="absolute inset-0 w-full h-full drop-shadow-sm" viewBox="0 0 144 80">
      <polygon
        points="72,3 141,40 72,77 3,40"
        className={`stroke-2 transition-all ${
          highlight
            ? 'stroke-amber-500 fill-amber-50 filter drop-shadow'
            : 'stroke-sky-600 fill-sky-50'
        }`}
      />
    </svg>
    <span className={`relative z-10 px-2 leading-tight ${highlight ? 'text-amber-950 font-extrabold' : 'text-sky-950'}`}>
      {label}
    </span>
  </div>
);

// Curved Return Edge (回边箭头)
export const FlowReturnEdge: React.FC<{
  label?: string;
  className?: string;
}> = ({ label = '是 / 再做一遍', className = '' }) => (
  <div className={`relative flex items-center justify-center ${className}`}>
    <svg className="w-48 h-32 overflow-visible" viewBox="0 0 192 128">
      <defs>
        <marker
          id="arrowhead-loop"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="#F59E0B" />
        </marker>
      </defs>
      {/* Return loop line from bottom right curving up and left */}
      <path
        d="M 120 20 C 180 20, 180 110, 80 110 C 20 110, 20 40, 20 25"
        fill="none"
        stroke="#F59E0B"
        strokeWidth="3.5"
        strokeDasharray="6,3"
        markerEnd="url(#arrowhead-loop)"
        className="animate-pulse"
      />
      <rect x="70" y="96" width="84" height="20" rx="4" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1" />
      <text x="112" y="110" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#B45309">
        {label}
      </text>
    </svg>
  </div>
);
