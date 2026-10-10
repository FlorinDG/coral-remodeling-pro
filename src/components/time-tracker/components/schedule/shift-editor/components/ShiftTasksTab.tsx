"use client";

import React, { useState } from 'react';
import { Loader2, ListTodo, Plus, Check, Trash } from 'lucide-react';
import { useTasks, useShiftTasks } from '@/components/time-tracker/hooks/useTasks';
import { taskFitsShift, taskProjectIdsOf } from '@/lib/records/shift-project-links';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

interface ShiftTasksTabProps {
  shiftId: string | null;
  projectId?: string | null;
  canManage?: boolean;
  isLocked?: boolean;
  onCountChange?: (count: number) => void;
}

export function ShiftTasksTab({
  shiftId,
  projectId,
  canManage = true,
  isLocked = false,
  onCountChange,
}: ShiftTasksTabProps) {
  const t = useTranslations('Hr.shifts.tasks');
  // The tasks this shift may carry — its project's, or the tasks without a project (core: taskFitsShift).
  const { tasks: allTasks, loading: tasksLoading, createTask } = useTasks(null);
  const projectTasks = allTasks.filter(task => taskFitsShift(taskProjectIdsOf(task.properties), projectId));
  const {
    shiftTasks,
    loading: shiftTasksLoading,
    assignTask,
    removeTask,
    completeShiftTask,
  } = useShiftTasks(shiftId);

  const [taskPopoverOpen, setTaskPopoverOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);

  // Available tasks not yet assigned to this shift
  const assignedTaskIds = new Set(shiftTasks.map(st => st.taskId));
  const availableTasks = projectTasks.filter(t => !assignedTaskIds.has(t.id));

  React.useEffect(() => {
    onCountChange?.(shiftTasks.length);
  }, [shiftTasks.length, onCountChange]);

  const handleAssignTask = async (taskId: string) => {
    if (isLocked) return;
    try {
      await assignTask(taskId, projectTasks.find(t => t.id === taskId));
      setTaskPopoverOpen(false);
      toast.success(t('assignedSuccess'));
    } catch {
      toast.error(t('assignedFailed'));
    }
  };

  const handleQuickCreateTask = async () => {
    if (!newTaskTitle.trim() || isLocked) return;
    setCreatingTask(true);
    try {
      const result = await createTask({
        title: newTaskTitle.trim(),
        projectId: projectId || undefined,
        priority: 'normal',
      });
      if (result?.data?.id) {
        await assignTask(result.data.id, result.data);
        setNewTaskTitle('');
        toast.success(t('createdSuccess'));
      } else {
        toast.error(result?.error || t('createdFailed'));
      }
    } catch {
      toast.error(t('createdFailed'));
    } finally {
      setCreatingTask(false);
    }
  };

  const handleRemoveTask = async (shiftTaskId: string) => {
    if (isLocked) return;
    try {
      await removeTask(shiftTaskId);
      toast.success(t('removedSuccess'));
    } catch {
      toast.error(t('removedFailed'));
    }
  };

  const handleCompleteTask = async (shiftTaskId: string) => {
    try {
      await completeShiftTask(shiftTaskId);
      toast.success(t('completedSuccess'));
    } catch {
      toast.error(t('completedFailed'));
    }
  };

  return (
    <div className="space-y-4 h-[min(648px,70vh)] overflow-y-auto pr-1">
      {/* Add task controls (hidden if locked or cannot manage) */}
      {canManage && !isLocked && (
        <div className="space-y-3 pb-2 border-b border-neutral-100 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Popover open={taskPopoverOpen} onOpenChange={setTaskPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Plus className="h-4 w-4 mr-1.5" />
                  {t('addExisting')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3" align="start">
                <div className="space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-neutral-500">
                    {projectId ? t('projectTasks') : t('tasksWithoutProject')}
                  </h4>
                  {tasksLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                    </div>
                  ) : availableTasks.length === 0 ? (
                    <p className="text-xs text-neutral-500 py-2">{t('noTasks')}</p>
                  ) : (
                    <ScrollArea className="h-48">
                      <div className="space-y-1">
                        {availableTasks.map(task => (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => handleAssignTask(task.id)}
                            className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 text-left text-xs transition"
                          >
                            <ListTodo className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                            <span className="truncate flex-1 font-medium">{task.title}</span>
                            {task.priority && task.priority !== 'normal' && (
                              <Badge
                                variant={task.priority === 'high' ? 'destructive' : 'secondary'}
                                className="text-[10px] uppercase font-bold px-1.5 py-0"
                              >
                                {task.priority}
                              </Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">
              {t('quickCreate')}
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder={t('taskPlaceholder')}
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickCreateTask();
                  }
                }}
                className="flex-1 h-9 text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleQuickCreateTask}
                disabled={!newTaskTitle.trim() || creatingTask}
                className="h-9 px-3"
              >
                {creatingTask ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assigned tasks list */}
      {shiftTasksLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      ) : shiftTasks.length === 0 ? (
        <div className="text-center py-8 text-neutral-500">
          <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{t('noAssignedTasks')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shiftTasks.map(shiftTask => (
            <div
              key={shiftTask.id}
              className={`flex items-center gap-3 p-3 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900/60 transition ${
                shiftTask.status === 'completed' ? 'opacity-60 bg-neutral-50 dark:bg-white/5' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-semibold text-neutral-900 dark:text-white ${
                    shiftTask.status === 'completed' ? 'line-through text-neutral-400' : ''
                  }`}
                >
                  {shiftTask.task?.title || t('unknownTask')}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {shiftTask.task?.priority && shiftTask.task.priority !== 'normal' && (
                    <Badge
                      variant={shiftTask.task.priority === 'high' ? 'destructive' : 'secondary'}
                      className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0"
                    >
                      {shiftTask.task.priority}
                    </Badge>
                  )}
                  {shiftTask.status === 'completed' && (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                      {t('completed')}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {shiftTask.status !== 'completed' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    onClick={() => handleCompleteTask(shiftTask.id)}
                    title={t('markCompleted')}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                {canManage && !isLocked && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                    onClick={() => handleRemoveTask(shiftTask.id)}
                    title={t('removeFromShift')}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
