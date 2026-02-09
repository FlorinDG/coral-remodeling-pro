"use client";

import { useState } from 'react';
import { CheckCircle, Circle, Plus } from 'lucide-react';

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
            body: JSON.stringify({ id, status: newStatus })
        });
    };

    return (
        <div className="glass-morphism p-6 rounded-3xl border border-white/10 h-full flex flex-col">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                Project Tasks
                <span className="bg-white/10 text-xs px-2 py-1 rounded-full">{tasks.filter(t => t.status === 'TODO').length} Remaining</span>
            </h3>

            <div className="flex-1 overflow-y-auto space-y-3 mb-4 custom-scrollbar pr-2">
                {tasks.length === 0 && <p className="text-neutral-500 italic text-sm">No active tasks.</p>}
                {tasks.map(task => (
                    <div
                        key={task.id}
                        onClick={() => toggleStatus(task.id, task.status)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${task.status === 'DONE'
                                ? 'bg-green-500/10 border-green-500/20 opacity-60'
                                : 'bg-black/20 border-white/5 hover:border-white/20'
                            } ${readOnly ? 'cursor-default' : ''}`}
                    >
                        {task.status === 'DONE'
                            ? <CheckCircle className="w-5 h-5 text-green-500" />
                            : <Circle className="w-5 h-5 text-neutral-500" />
                        }
                        <span className={`text-sm ${task.status === 'DONE' ? 'line-through text-neutral-500' : 'text-white'}`}>
                            {task.title}
                        </span>
                    </div>
                ))}
            </div>

            {!readOnly && (
                <form onSubmit={handleAddTask} className="relative">
                    <input
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        placeholder="Add a new task..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm focus:border-[#d35400] outline-none transition-colors"
                    />
                    <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-[#d35400] rounded-lg hover:bg-[#a04000] transition-colors">
                        <Plus className="w-4 h-4 text-white" />
                    </button>
                </form>
            )}
        </div>
    );
}
