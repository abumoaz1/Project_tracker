export type UserRole = "admin" | "member";
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface User {
    id: string;
    email: string;
    full_name: string;
    is_active: boolean;
    created_at: string;
}

export interface Member {
    user_id: string;
    role: UserRole;
    joined_at: string;
    user: User;
}

export interface Project {
    id: string;
    name: string;
    description?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    members: Member[];
}

export interface ProjectSummary {
    id: string;
    name: string;
    description?: string;
    is_active: boolean;
    created_at: string;
    task_count: number;
    member_count: number;
}

export interface Task {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date?: string;
    project_id: string;
    assignee_id?: string;
    created_by?: string;
    created_at: string;
    updated_at: string;
    assignee?: User;
    creator?: User;
}

export interface DashboardStats {
    total_projects: number;
    total_tasks: number;
    my_tasks: number;
    overdue_tasks: number;
    tasks_by_status: Record<TaskStatus, number>;
    recent_tasks: Task[];
}

export interface TokenPair {
    access_token: string;
    refresh_token: string;
    token_type: string;
}

// Form types
export interface LoginForm {
    email: string;
    password: string;
}

export interface SignupForm {
    email: string;
    full_name: string;
    password: string;
}

export interface ProjectForm {
    name: string;
    description?: string;
}

export interface TaskForm {
    title: string;
    description?: string;
    priority: TaskPriority;
    due_date?: string;
    assignee_id?: string;
}
