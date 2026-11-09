import React, { useEffect, useState, useMemo } from 'react';
import { ClassId, Student } from '../../types';
import { buildRoster, createManualStudent } from '../../data/roster';
import { apiRoster } from '../../api/client';

interface LoginViewProps {
  onLogin: (student: Student) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [selectedClass, setSelectedClass] = useState<ClassId>('501');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isManualInput, setIsManualInput] = useState(false);
  const [manualName, setManualName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [roster, setRoster] = useState(() => buildRoster([]));
  const [rosterStatus, setRosterStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [rosterRequest, setRosterRequest] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiRoster().then(({ classes }) => {
      if (cancelled) return;
      setRoster(buildRoster(classes));
      setRosterStatus('ready');
    }).catch(() => {
      if (!cancelled) setRosterStatus('error');
    });
    return () => { cancelled = true; };
  }, [rosterRequest]);

  const currentClassStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return roster[selectedClass].filter(student => student.name.toLowerCase().includes(query));
  }, [roster, selectedClass, searchQuery]);

  const handleSelectStudent = (s: Student) => {
    setSelectedStudent(s);
    setIsManualInput(false);
    setErrorMsg('');
  };

  const handleClassChange = (c: ClassId) => {
    setSelectedClass(c);
    setSelectedStudent(null);
    setSearchQuery('');
    setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isManualInput) {
      const trimmed = manualName.trim();
      if (!trimmed) {
        setErrorMsg('请输入你的真实姓名');
        return;
      }
      const newStudent = createManualStudent(selectedClass, trimmed);
      onLogin(newStudent);
      return;
    }

    if (!selectedStudent) {
      setErrorMsg('请在名单中点选你的姓名');
      return;
    }

    onLogin(selectedStudent);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Background Shenzhen intersection graphics styling */}
      <div className="absolute inset-0 opacity-15 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#F59E0B_1px,transparent_1px)] [background-size:24px_24px]" />
        {/* Zebra crossing pattern */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-[repeating-linear-gradient(90deg,#fff,#fff_40px,transparent_40px,transparent_80px)] opacity-20" />
      </div>

      <div className="max-w-xl w-full bg-slate-800/90 border border-slate-700/80 rounded-3xl p-8 shadow-2xl backdrop-blur-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-semibold mb-3">
            <span>五年级《身边的算法》第7课</span>
            <span>·</span>
            <span>重复操作用循环</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            莲花山智慧路口 · 临时小交警
          </h1>
          <p className="text-slate-400 text-sm">
            欢迎来到深圳开放日路口！请先选择你的班级与姓名领取任务单
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Select Class */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              第一步：选择班级
            </label>
            <div className="grid grid-cols-4 gap-2.5">
              {(['501', '502', '503', '504'] as ClassId[]).map(c => {
                const count = roster[c].length;
                const isSelected = selectedClass === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleClassChange(c)}
                    className={`py-3 px-2 rounded-xl text-center font-bold text-sm transition-all border ${
                      isSelected
                        ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-md ring-2 ring-amber-400/40 scale-102'
                        : 'bg-slate-700/60 border-slate-600 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <div>{c} 班</div>
                    <div className={`text-[10px] font-normal mt-0.5 ${isSelected ? 'text-slate-800' : 'text-slate-400'}`}>
                      {rosterStatus === 'ready' ? `${count} 人` : '—'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Select Name */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                第二步：选择你的姓名
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsManualInput(!isManualInput);
                  setSelectedStudent(null);
                  setErrorMsg('');
                }}
                className="text-xs text-amber-400 hover:underline"
              >
                {isManualInput ? '从名单中挑选' : '名单外手动输入'}
              </button>
            </div>

            {isManualInput ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  placeholder="请输入姓名（如：张三）"
                  className="w-full bg-slate-900/90 border border-amber-500/60 focus:border-amber-400 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition"
                  autoFocus
                />
                <p className="text-[11px] text-amber-300">
                  确认将该姓名加入 {selectedClass} 班临时小交警记录
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Search input */}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="输入姓名关键词"
                  className="w-full bg-slate-900/70 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none transition"
                />

                {/* Name pills grid */}
                <div className="max-h-48 overflow-y-auto pr-1 grid grid-cols-3 sm:grid-cols-4 gap-2 border border-slate-700/60 p-2.5 rounded-xl bg-slate-900/40">
                  {currentClassStudents.map(s => {
                    const isSelected = selectedStudent?.studentId === s.studentId;
                    return (
                      <button
                        key={s.studentId}
                        type="button"
                        onClick={() => handleSelectStudent(s)}
                        className={`py-2 px-1 text-xs font-medium rounded-lg text-center truncate transition-all border ${
                          isSelected
                            ? 'bg-amber-500 border-amber-400 text-slate-950 font-bold shadow-sm ring-1 ring-amber-300'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                  {currentClassStudents.length === 0 && (
                    <div className="col-span-full py-6 text-center text-xs text-slate-500">
                      {rosterStatus === 'loading' ? '正在读取本班名单…' : rosterStatus === 'error' ? (
                        <button type="button" className="text-amber-400 underline" onClick={() => {
                          setRosterStatus('loading');
                          setRosterRequest(value => value + 1);
                        }}>名单暂时加载失败，点此重试</button>
                      ) : '未找到对应同学，可切换上方为手动输入'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5 text-center font-medium">
              {errorMsg}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!selectedStudent && (!isManualInput || !manualName.trim())}
            className={`w-full h-14 rounded-2xl font-bold text-base transition-all shadow-lg flex items-center justify-center gap-2 ${
              (selectedStudent || (isManualInput && manualName.trim()))
                ? 'bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 cursor-pointer shadow-amber-500/20'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed border border-slate-600'
            }`}
          >
            <span>穿上小交警马甲，进入路口</span>
            <span>→</span>
          </button>
        </form>
      </div>
    </div>
  );
};
