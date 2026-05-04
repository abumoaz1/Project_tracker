"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DashboardStats, Task } from "@/types";
import { format, isPast } from "date-fns";
import { Loader2, FolderKanban, CheckSquare, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";

function StatCard({ label, value, icon: Icon, color }: {
    label: string; value: number; icon: React.ElementType; color: string;
}) {
    return (
        <div className="card p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-500">{label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
            </div>
        </div>
    );
}

function StatusBar({ stats }: { stats: DashboardStats }) {
    const total = stats.total_tasks || 1;
    const done = stats.tasks_by_status.done || 0;
    const inProgress = stats.tasks_by_status.in_progress || 0;
    const todo = stats.tasks_by_status.todo || 0;

    return (
        <div className="card p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Task breakdown</h2>
            <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-4">
                <div className="bg-green-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
                <div className="bg-blue-500 transition-all" style={{ width: `${(inProgress / total) * 100}%` }} />
                <div className="bg-gray-200 transition-all" style={{ width: `${(todo / total) * 100}%` }} />
            </div>
            <div className="flex gap-6 text-sm">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Done ({done})</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />In progress ({inProgress})</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" />Todo ({todo})</span>
            </div>
        </div>
    );
}

function RecentTask({ task }: { task: Task }) {
    const overdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "done";
    return (
        <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                <p className="text-xs text-gray-500">
                    {task.due_date && (
                        <span className={overdue ? "text-red-500" : ""}>
                            {overdue ? "Overdue · " : "Due · "}
                            {format(new Date(task.due_date), "MMM d")}
                        </span>
                    )}
                </p>
            </div>
            <span className={`badge-${task.status} ml-3 shrink-0`}>
                {task.status.replace("_", " ")}
            </span>
        </div>
    );
}

export default function DashboardPage() {
    const { user } = useAuth();
    const { data, isLoading } = useQuery<DashboardStats>({
        queryKey: ["dashboard"],
        queryFn: () => dashboardApi.stats().then((r) => r.data),
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full min-h-96">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">
                    Good {new Date().getHours() < 12 ? "morning" : "afternoon"}, {user?.full_name?.split(" ")[0]} 👋
                </h1>
                <p className="text-gray-500 text-sm mt-1">Here&apos;s what&apos;s happening with your projects.</p>
            </div>

            {data && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <StatCard label="Projects" value={data.total_projects} icon={FolderKanban} color="bg-blue-600" />
                        <StatCard label="Total tasks" value={data.total_tasks} icon={CheckSquare} color="bg-indigo-600" />
                        <StatCard label="My tasks" value={data.my_tasks} icon={Clock} color="bg-purple-600" />
                        <StatCard label="Overdue" value={data.overdue_tasks} icon={AlertTriangle} color={data.overdue_tasks > 0 ? "bg-red-500" : "bg-gray-400"} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <StatusBar stats={data} />

                        <div className="card p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-semibold text-gray-700">Recent tasks</h2>
                                <Link href="/projects" className="text-xs text-blue-600 hover:underline">View projects →</Link>
                            </div>
                            {data.recent_tasks.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-8">No tasks yet</p>
                            ) : (
                                data.recent_tasks.map((t) => <RecentTask key={t.id} task={t} />)
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
