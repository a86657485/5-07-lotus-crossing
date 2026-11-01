import React from 'react';

interface GodotLabViewProps {
  studentId?: string;
  onBackToMap: () => void;
}

/**
 * Phase B 可选入口：iframe 嵌入 public/godot HTML5 导出。
 * 不替代 Studio 三站主探究路径。
 */
export const GodotLabView: React.FC<GodotLabViewProps> = ({ studentId, onBackToMap }) => {
  const src = studentId
    ? `/godot/index.html?studentId=${encodeURIComponent(studentId)}`
    : '/godot/index.html';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-3 gap-3">
      <div className="flex items-center justify-between gap-3 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3">
        <div>
          <div className="font-bold text-sm">Godot 试验台（Phase B）</div>
          <div className="text-[11px] text-slate-400">
            主探究仍走地图三站；此处仅验证 JS 桥与 HTML5 嵌入
          </div>
        </div>
        <button
          type="button"
          onClick={onBackToMap}
          className="text-xs px-3 py-1.5 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700"
        >
          返回地图
        </button>
      </div>
      <iframe
        title="Godot Lab"
        src={src}
        className="flex-1 w-full min-h-[70vh] rounded-2xl border border-slate-700 bg-black"
        allow="autoplay; fullscreen"
      />
    </div>
  );
};
