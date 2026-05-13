"use client";

import React, { useState } from 'react';
import { CheckCircle2, Circle, Plus, Trash2, ListTodo } from 'lucide-react';

interface Task {
    id: string;
    text: string;
    completed: boolean;
}

interface InternalTasklistProps {
    tasks: Task[];
    onTasksChange: (tasks: Task[]) => void;
    brandColor?: string;
}

export default function InternalTasklist({ tasks = [], onTasksChange, brandColor = '#d35400' }: InternalTasklistProps) {
    const [newTaskText, setNewTaskText] = useState('');

    const addTask = () => {
        if (!newTaskText.trim()) return;
        const newTask: Task = {
            id: crypto.randomUUID(),
            text: newTaskText.trim(),
            completed: false
        };
        onTasksChange([...tasks, newTask]);
        setNewTaskText('');
    };

    const toggleTask = (id: string) => {
        onTasksChange(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    const deleteTask = (id: string) => {
        onTasksChange(tasks.filter(t => t.id !== id));
    };

    return (
        <div className="flex flex-col gap-4 p-4 border-t border-neutral-200 dark:border-white/10">
            <div className="flex items-center gap-2 text-neutral-500 mb-1">
                <ListTodo className="w-4 h-4" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider">Internal Tasklist</h3>
            </div>

            <div className="flex flex-col gap-2">
                {tasks.map(task => (
                    <div key={task.id} className="flex items-start gap-2 group">
                        <button 
                            onClick={() => toggleTask(task.id)}
                            className="mt-0.5 shrink-0 transition-colors"
                            style={{ color: task.completed ? '#16a34a' : '#d1d5db' }}
                        >
                            {task.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                        </button>
                        <span className={`text-xs flex-1 transition-all ${task.completed ? 'text-neutral-400 line-through' : 'text-neutral-700 dark:text-neutral-300'}`}>
                            {task.text}
                        </span>
                        <button 
                            onClick={() => deleteTask(task.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-300 hover:text-red-500"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                ))}
                
                {tasks.length === 0 && (
                    <p className="text-[10px] text-neutral-400 italic py-2 text-center">No internal tasks yet.</p>
                )}
            </div>

            <div className="flex items-center gap-2 mt-2">
                <input
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTask()}
                    placeholder="Add helper task..."
                    className="flex-1 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 transition-all"
                    style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                />
                <button
                    onClick={addTask}
                    className="p-1.5 rounded-lg text-white shadow-sm transition-all active:scale-95"
                    style={{ backgroundColor: brandColor }}
                >
                    <Plus className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
