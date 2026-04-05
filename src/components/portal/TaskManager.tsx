"use client";

import { useState } from 'react';
import { CheckCircle, Plus, Calendar, Paperclip, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Task {
    id: string;
    title: string;
    status: string;
    dueDate?: string | Date | null;
    fileUrl?: string | null;
}

interface TaskManagerProps {
    portalId: string;
    initialTasks: Task[];
    readOnly?: boolean;
}

export default function TaskManager({ portalId, initialTasks, readOnly = false }: TaskManagerProps) {
    const t = useTranslations('Portal');
    const [tasks, setTasks] = useState(initialTasks);
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        dueDate: '',
        fileUrl: ''
    });

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim()) return;

        const res = await fetch('/api/portals/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                portalId,
                title: formData.title,
                dueDate: formData.dueDate || null,
                fileUrl: formData.fileUrl || null
            })
        });
        const task = await res.json();
        setTasks([...tasks, task]);
        setFormData({ title: '', dueDate: '', fileUrl: '' });
        setIsAdding(false);
    };

    const toggleStatus = async (id: string, currentStatus: string) => {
        if (readOnly) return;
        const newStatus = currentStatus === 'DONE' ? 'TODO' : 'DONE';

        setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t));

        await fetch('/api/portals/tasks', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: newStatus })
        });
    };

    const remainingTasks = tasks.filter(t => t.status !== 'DONE').length;

    return (
        <div className="bg-neutral-50 dark:bg-white/5 rounded-[2.5rem] border border-neutral-200 dark:border-white/5 p-8 h-full flex flex-col shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold flex items-center gap-3 text-neutral-900 dark:text-white">
                    {t('tasks')}
                    <span className="bg-[#d75d00] text-white text-[10px] font-black px-2 py-0.5 rounded-full">{remainingTasks}</span>
                </h3>
                {!readOnly && !isAdding && (
                    <button onClick={() => setIsAdding(true)} className="p-2 bg-[#d75d00] text-white rounded-full hover:bg-neutral-900 transition-all">
                        <Plus className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 mb-2 pr-2 custom-scrollbar">
                {isAdding && (
                    <div className="glass-morphism p-6 rounded-3xl border border-[#d75d00]/20 animate-in slide-in-from-top-4 duration-300">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#d75d00]">New Task</span>
                            <button onClick={() => setIsAdding(false)}><X className="w-4 h-4 text-neutral-400" /></button>
                        </div>
                        <form onSubmit={handleAddTask} className="space-y-4">
                            <input
                                autoFocus
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Task title..."
                                className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d75d00] outline-none transition-colors"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest px-1">Due Date</label>
                                    <input
                                        type="date"
                                        value={formData.dueDate}
                                        onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                                        className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs focus:border-[#d75d00] outline-none transition-colors"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest px-1">File URL</label>
                                    <input
                                        type="text"
                                        placeholder="Attachment link"
                                        value={formData.fileUrl}
                                        onChange={e => setFormData({ ...formData, fileUrl: e.target.value })}
                                        className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs focus:border-[#d75d00] outline-none transition-colors"
                                    />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-[#d75d00] text-white py-3 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-neutral-900 transition-all">
                                Create Task
                            </button>
                        </form>
                    </div>
                )}

                {tasks.length === 0 && !isAdding && (
                    <p className="text-neutral-500 italic text-center py-10 text-sm">{t('noTasks')}</p>
                )}
                {tasks.map(task => (
                    <div
                        key={task.id}
                        className={`p-5 rounded-[1.5rem] border transition-all flex flex-col gap-3 ${task.status === 'DONE'
                            ? 'bg-neutral-100/50 dark:bg-white/5 border-neutral-200 dark:border-white/5 opacity-50'
                            : 'bg-white dark:bg-black/40 border-neutral-200 dark:border-white/10 hover:border-[#d75d00]/50 shadow-sm'
                            }`}
                    >
                        <div className="flex items-center gap-4">
                            <div
                                onClick={() => toggleStatus(task.id, task.status)}
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${task.status === 'DONE' ? 'bg-[#d75d00] border-[#d75d00]' : 'border-neutral-300 dark:border-neutral-700'
                                    }`}>
                                {task.status === 'DONE' && <CheckCircle className="w-4 h-4 text-white" />}
                            </div>
                            <span className={`flex-1 text-sm font-medium ${task.status === 'DONE' ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-900 dark:text-white'}`}>
                                {task.title}
                            </span>
                        </div>

                        {(task.dueDate || task.fileUrl) && (
                            <div className="flex gap-4 ml-10">
                                {task.dueDate && (
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-widest bg-neutral-100 dark:bg-white/5 px-2 py-1 rounded-lg">
                                        <Calendar className="w-3 h-3 text-[#d75d00]" />
                                        {new Date(task.dueDate).toLocaleDateString()}
                                    </div>
                                )}
                                {task.fileUrl && (
                                    <a
                                        href={task.fileUrl}
                                        target="_blank"
                                        className="flex items-center gap-1.5 text-[10px] font-bold text-[#d75d00] uppercase tracking-widest bg-[#d75d00]/10 px-2 py-1 rounded-lg hover:bg-[#d75d00]/20 transition-colors"
                                    >
                                        <Paperclip className="w-3 h-3" />
                                        Attachment
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
