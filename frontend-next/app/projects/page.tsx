"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "@/lib/api";
import { ProjectSummary } from "@/types";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Folder, Users, CheckSquare, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";

function ProjectCard({ project, onDelete }: { project: ProjectSummary; onDelete: (id: string) => void }) {
    return (
        <div className="card p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
                <Link href={`/projects/${project.id}`} className="flex items-center gap-3 group flex-1">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                        <Folder className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{project.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{format(new Date(project.created_at), "MMM d, yyyy")}</p>
                    </div>
                </Link>
                <button
                    onClick={() => onDelete(project.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors ml-2"
                    title="Delete project"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {project.description && (
                <p className="text-sm text-gray-500 mb-4 line-clamp-2">{project.description}</p>
            )}

            <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5" />{project.task_count} tasks</span>
                <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{project.member_count} members</span>
            </div>
        </div>
    );
}

function CreateProjectModal({ onClose }: { onClose: () => void }) {
    const queryClient = useQueryClient();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    const mutation = useMutation({
        mutationFn: () => projectsApi.create({ name, description }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            toast.success("Project created!");
            onClose();
        },
        onError: () => toast.error("Failed to create project"),
    });

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">New project</h2>
                <div className="space-y-4">
                    <div>
                        <label className="label">Project name *</label>
                        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="My project" autoFocus />
                    </div>
                    <div>
                        <label className="label">Description</label>
                        <textarea className="input resize-none" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this project about?" />
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                    <button
                        onClick={() => mutation.mutate()}
                        disabled={!name.trim() || mutation.isPending}
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                        {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ProjectsPage() {
    const [showCreate, setShowCreate] = useState(false);
    const queryClient = useQueryClient();

    const { data: projects, isLoading } = useQuery<ProjectSummary[]>({
        queryKey: ["projects"],
        queryFn: () => projectsApi.list().then((r) => r.data),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => projectsApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            toast.success("Project deleted");
        },
        onError: () => toast.error("Failed to delete project (admin only)"),
    });

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
                    <p className="text-gray-500 text-sm mt-1">All projects you&apos;re a member of</p>
                </div>
                <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    New project
                </button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            ) : projects?.length === 0 ? (
                <div className="text-center py-20">
                    <Folder className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-gray-500 font-medium">No projects yet</h3>
                    <p className="text-gray-400 text-sm mt-1">Create your first project to get started</p>
                    <button onClick={() => setShowCreate(true)} className="btn-primary mt-4 inline-flex items-center gap-2">
                        <Plus className="w-4 h-4" /> New project
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects?.map((p) => (
                        <ProjectCard key={p.id} project={p} onDelete={(id) => deleteMutation.mutate(id)} />
                    ))}
                </div>
            )}

            {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
        </div>
    );
}