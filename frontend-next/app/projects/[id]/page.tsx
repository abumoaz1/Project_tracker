"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, tasksApi } from "@/lib/api";
import { Project, Task, Member, TaskStatus, TaskPriority } from "@/types";
import { useAuth } from "@/lib/auth-context";
import { useState, use } from "react";
import { toast } from "sonner";
import {
  Plus, ChevronLeft, Loader2, UserPlus, Users, Trash2
} from "lucide-react";
import Link from "next/link";
import { format, isPast } from "date-fns";
import { clsx } from "clsx";

// ── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, projectId, isAdmin, members }: { task: Task; projectId: string; isAdmin: boolean; members: Member[] }) {
  const queryClient = useQueryClient();
  const overdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "done";

  const statusMutation = useMutation({
    mutationFn: (status: TaskStatus) => tasksApi.update(projectId, task.id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", projectId] }),
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to update status"),
  });

  const assignMutation = useMutation({
    mutationFn: (assignee_id: string | null) => tasksApi.update(projectId, task.id, { assignee_id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", projectId] }),
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to reassign task"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(projectId, task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      toast.success("Task deleted");
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to delete task"),
  });

  const nextStatus: Record<TaskStatus, TaskStatus> = {
    todo: "in_progress", in_progress: "done", done: "todo"
  };

  return (
    <div className={clsx("card p-4 hover:shadow-md transition-shadow", overdue && "border-red-200")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate">{task.title}</h4>
          {task.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>}
        </div>
        {isAdmin && (
          <button onClick={() => deleteMutation.mutate()} className="text-gray-300 hover:text-red-500 shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button
          onClick={() => statusMutation.mutate(nextStatus[task.status])}
          className={`badge-${task.status} cursor-pointer hover:opacity-80`}
          title="Click to advance status"
        >
          {task.status.replace("_", " ")}
        </button>
        <span className={`badge-${task.priority}`}>{task.priority}</span>
        {overdue && <span className="text-xs text-red-500 font-medium">Overdue</span>}
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          {isAdmin ? (
            <select
              className="bg-transparent border-none text-xs text-gray-500 cursor-pointer outline-none hover:text-gray-800 p-0 focus:ring-0"
              value={task.assignee_id || ""}
              onChange={(e) => assignMutation.mutate(e.target.value || null)}
              title="Change assignee"
            >
              <option value="">Unassigned</option>
              {members.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.user.full_name}</option>
              ))}
            </select>
          ) : (
            task.assignee && <span>→ {task.assignee.full_name}</span>
          )}
        </div>
        {task.due_date && (
          <span className={overdue ? "text-red-500" : ""}>
            {format(new Date(task.due_date), "MMM d")}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Create Task Modal ────────────────────────────────────────────────────────

function CreateTaskModal({ projectId, onClose }: {
  projectId: string; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  // Read live data from cache — always up-to-date even if a member was just added
  const { data: project } = useQuery<Project>({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.get(projectId).then((r) => r.data),
  });
  const members: Member[] = project?.members ?? [];

  const [form, setForm] = useState({
    title: "", description: "", priority: "medium" as TaskPriority,
    due_date: "", assignee_id: "",
  });

  const mutation = useMutation({
    mutationFn: () => tasksApi.create(projectId, {
      ...form,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
      assignee_id: form.assignee_id || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Task created!");
      onClose();
    },
    onError: () => toast.error("Failed to create task"),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">New task</h2>
        <div className="space-y-3">
          <div>
            <label className="label">Title *</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Task title" autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="label">Due date</label>
              <input type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Assign to</label>
            <select className="input" value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.user.full_name}</option>
              ))}
            </select>
            {members.length <= 1 && (
              <p className="text-xs text-gray-400 mt-1">
                💡 Add team members via &quot;Add member&quot; to assign tasks to them
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!form.title.trim() || mutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Member Modal ─────────────────────────────────────────────────────────

function AddMemberModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");

  const mutation = useMutation({
    mutationFn: () => projectsApi.addMember(projectId, { email, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Member added!");
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to add member"),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Add team member</h2>
        <div className="space-y-3">
          <div>
            <label className="label">Email address</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@example.com" autoFocus />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!email || mutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      toast.success("Member removed");
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to remove member"),
  });

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id).then((r) => r.data),
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["tasks", id, statusFilter],
    queryFn: () => tasksApi.list(id, statusFilter !== "all" ? { status: statusFilter } : {}).then((r) => r.data),
  });

  const isAdmin = project?.members.find((m) => m.user_id === user?.id)?.role === "admin";

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!project) return <div className="p-8 text-gray-500">Project not found</div>;

  const statusGroups: TaskStatus[] = ["todo", "in_progress", "done"];
  const groupedTasks: Record<string, Task[]> = { todo: [], in_progress: [], done: [] };
  tasks?.forEach((t) => {
    if (groupedTasks[t.status]) groupedTasks[t.status].push(t);
  });

  const statusLabels: Record<string, string> = { todo: "To do", in_progress: "In progress", done: "Done" };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/projects" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Projects</span>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          {project.description && <p className="text-gray-500 text-sm mt-1">{project.description}</p>}
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={() => setShowAddMember(true)} className="btn-secondary flex items-center gap-2 text-sm">
              <UserPlus className="w-4 h-4" /> Add member
            </button>
          )}
          <button onClick={() => setShowCreateTask(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> New task
          </button>
        </div>
      </div>

      {/* Members strip */}
      <div className="card p-4 mb-6 flex items-center gap-4">
        <Users className="w-4 h-4 text-gray-400" />
        <div className="flex items-center gap-2 flex-wrap">
          {project.members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-full pr-3 pl-1 py-1 group">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600" title={m.user.full_name}>
                {m.user.full_name[0]}
              </div>
              <span className="text-sm font-medium text-gray-700">{m.user.full_name}</span>
              {m.role === "admin" && (
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">admin</span>
              )}
              {isAdmin && m.user_id !== user?.id && (
                <button
                  onClick={() => removeMemberMutation.mutate(m.user_id)}
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                  title="Remove member"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {(["all", ...statusGroups] as Array<TaskStatus | "all">).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={clsx(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              statusFilter === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {s === "all" ? "All" : statusLabels[s]}
          </button>
        ))}
      </div>

      {/* Task board */}
      {tasksLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : statusFilter === "all" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statusGroups.map((s) => (
            <div key={s}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-gray-700">{statusLabels[s]}</h3>
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{groupedTasks[s].length}</span>
              </div>
              <div className="space-y-3">
                {groupedTasks[s].length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">No tasks</p>
                ) : (
                  groupedTasks[s].map((t) => (
                    <TaskCard key={t.id} task={t} projectId={id} isAdmin={!!isAdmin} members={project.members} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3 max-w-lg">
          {tasks?.length === 0 ? (
            <p className="text-gray-400 text-center py-12">No tasks with this status</p>
          ) : (
            tasks?.map((t) => <TaskCard key={t.id} task={t} projectId={id} isAdmin={!!isAdmin} members={project.members} />)
          )}
        </div>
      )}

      {showCreateTask && <CreateTaskModal projectId={id} onClose={() => setShowCreateTask(false)} />}
      {showAddMember && <AddMemberModal projectId={id} onClose={() => setShowAddMember(false)} />}
    </div>
  );
}
