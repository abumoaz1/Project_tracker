from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.models import Task, Project, ProjectMember, User, TaskStatus, UserRole
from app.schemas.schemas import DashboardStats, TaskOut
from app.core.deps import get_current_user

router = APIRouter()


@router.get("/", response_model=DashboardStats)
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Projects user belongs to and their roles
    project_memberships_result = await db.execute(
        select(ProjectMember).where(ProjectMember.user_id == current_user.id)
    )
    project_roles = {pm.project_id: pm.role for pm in project_memberships_result.scalars().all()}
    project_ids = list(project_roles.keys())

    # Count distinct active projects
    total_projects = len(project_ids)

    # All tasks in those projects
    all_tasks_result = await db.execute(
        select(Task).where(Task.project_id.in_(project_ids))
        .options(selectinload(Task.assignee), selectinload(Task.creator))
    )
    all_tasks = all_tasks_result.scalars().all()

    # Filter tasks based on visibility rules
    visible_tasks = []
    for t in all_tasks:
        role = project_roles.get(t.project_id)
        if role == UserRole.ADMIN or t.assignee_id == current_user.id:
            visible_tasks.append(t)

    total_tasks = len(visible_tasks)

    # My tasks
    my_tasks = [t for t in visible_tasks if t.assignee_id == current_user.id]

    # Overdue tasks (due_date < now AND not done)
    now = datetime.now(timezone.utc)
    overdue = [
        t for t in visible_tasks
        if t.due_date and t.due_date.replace(tzinfo=timezone.utc) < now
        and t.status != TaskStatus.DONE
    ]

    # Tasks by status
    status_counts = {s.value: 0 for s in TaskStatus}
    for t in visible_tasks:
        status_counts[t.status.value] += 1

    # Recent 5 tasks
    recent = sorted(visible_tasks, key=lambda t: t.created_at, reverse=True)[:5]

    return DashboardStats(
        total_projects=total_projects,
        total_tasks=total_tasks,
        my_tasks=len(my_tasks),
        overdue_tasks=len(overdue),
        tasks_by_status=status_counts,
        recent_tasks=[TaskOut.model_validate(t) for t in recent],
    )