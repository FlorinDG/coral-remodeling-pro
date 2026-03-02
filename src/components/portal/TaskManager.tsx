"use client";

import { useState } from 'react';
import { CheckCircle, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Task {
    id: string;
    title: string;
    status: string;
}

interface TaskManagerProps {
    portalId: string;
    initialTasks: Task[];
    readOnly?: boolean;
}

export default function TaskManager({ portalId, initialTasks, readOnly = false }: TaskManagerProps) {
    const t = useTranslations('Portal');
    const [tasks, setTasks] = useState(initialTasks);
    const [newTask, setNewTask] = useState('');

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.trim()) return;

        const res = await fetch('/api/portals/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portalId, title: newTask })
        });
        const task = await res.json();
        setTasks([...tasks, task]);
        setNewTask('');
    };

    const toggleStatus = async (id: string, currentStatus: string) => {
        if (readOnly) return;
        const newStatus = currentStatus === 'DONE' ? 'TODO' : 'DONE';

        // Optimistic update
        setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t));

        await fetch('/api/portals/tasks', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: newStatus }) // Send original status field to API
        });
    };

    const remainingTasks = tasks.filter(t => t.status !== 'DONE').length;

    return (
        <div className="bg-neutral-50 dark:bg-white/5 rounded-3xl border border-neutral-200 dark:border-white/5 p-8 h-full flex flex-col">
            <h3 className="text-2xl font-bold mb-6 flex items-center justify-between text-neutral-900 dark:text-white">
                {t('tasks')}
                <span className="text-sm font-normal text-neutral-500">{t('remaining', { count: remainingTasks })}</span>
            </h3>

            <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2 custom-scrollbar">
                {tasks.length === 0 && (
                    <p className="text-neutral-500 italic text-center py-10">{t('noTasks')}</p>
                )}
                {tasks.map(task => (
                    <div
                        key={task.id}
                        onClick={() => toggleStatus(task.id, task.status)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${task.status === 'DONE'
                            ? 'bg-neutral-100/50 dark:bg-white/5 border-neutral-200 dark:border-white/5 opacity-50'
                            : 'bg-white/80 dark:bg-black/40 border-neutral-200 dark:border-white/10 hover:border-[#d35400] shadow-sm dark:shadow-none'
                            }`}
                    >
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${task.status === 'DONE' ? 'bg-[#d35400] border-[#d35400]' : 'border-neutral-300 dark:border-neutral-600'
                            }`}>
                            {task.status === 'DONE' && <CheckCircle className="w-4 h-4 text-white" />}
                        </div>
                        <span className={`flex-1 text-sm ${task.status === 'DONE' ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-900 dark:text-white'}`}>
                            {task.title}
                        </span>
                    </div>
                ))}
            </div>

            {!readOnly && (
                <form onSubmit={handleAddTask} className="relative">
                    <input
                        type="text"
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        placeholder={t('addTask')}
                        className="w-full bg-white/80 dark:bg-black/40 border border-neutral-200 dark:border-white/10 rounded-2xl px-6 py-4 text-sm outline-none focus:border-[#d35400] transition-colors text-neutral-900 dark:text-white"
                    />
                    <button
                        type="submit"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#d35400] text-white rounded-xl hover:bg-[#a04000] transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </form>
            )}
        </div>
    );
}
