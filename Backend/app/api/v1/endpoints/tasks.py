import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.models import Task, ProjectMember, User, UserRole, TaskStatus
from app.schemas.schemas import TaskCreate, TaskUpdate, TaskOut
from app.core.deps import get_current_user, get_project_member

router = APIRouter()


@router.get("/projects/{project_id}/tasks", response_model=List[TaskOut])
async def list_tasks(
    project_id: uuid.UUID,
    status: Optional[TaskStatus] = Query(default=None),
    assignee_id: Optional[uuid.UUID] = Query(default=None),
    overdue_only: bool = Query(default=False),
    membership: ProjectMember = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List tasks. Admins see all tasks, members only see tasks assigned to them."""
    filters = [Task.project_id == project_id]

    if membership.role == UserRole.MEMBER:
        filters.append(Task.assignee_id == current_user.id)
    elif assignee_id:
        filters.append(Task.assignee_id == assignee_id)

    if status:
        filters.append(Task.status == status)

    if overdue_only:
        filters.append(Task.due_date < datetime.now(timezone.utc))
        filters.append(Task.status != TaskStatus.DONE)

    result = await db.execute(
        select(Task)
        .where(and_(*filters))
        .options(selectinload(Task.assignee), selectinload(Task.creator))
        .order_by(Task.created_at.desc())
    )
    return result.scalars().all()


@router.post("/projects/{project_id}/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    project_id: uuid.UUID,
    payload: TaskCreate,
    membership: ProjectMember = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a task. Members can only assign to themselves."""
    assignee_id = payload.assignee_id

    if membership.role == UserRole.MEMBER:
        # Members can only assign tasks to themselves
        assignee_id = current_user.id
    elif assignee_id:
        # Admin: verify assignee is a project member
        result = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == assignee_id,
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Assignee must be a project member")

    task = Task(
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        due_date=payload.due_date,
        project_id=project_id,
        assignee_id=assignee_id,
        created_by=current_user.id,
    )
    db.add(task)
    await db.flush()

    result = await db.execute(
        select(Task).where(Task.id == task.id)
        .options(selectinload(Task.assignee), selectinload(Task.creator))
    )
    return result.scalar_one()


@router.get("/projects/{project_id}/tasks/{task_id}", response_model=TaskOut)
async def get_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    membership: ProjectMember = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Task)
        .where(Task.id == task_id, Task.project_id == project_id)
        .options(selectinload(Task.assignee), selectinload(Task.creator))
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Members can only view their own tasks
    if membership.role == UserRole.MEMBER and task.assignee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return task


@router.patch("/projects/{project_id}/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TaskUpdate,
    membership: ProjectMember = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.project_id == project_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if membership.role == UserRole.MEMBER:
        # Members can only update their own tasks and only status field
        if task.assignee_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        allowed = {"status"}
        update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if k in allowed}
    else:
        update_data = payload.model_dump(exclude_unset=True)
        if "assignee_id" in update_data and update_data["assignee_id"]:
            result2 = await db.execute(
                select(ProjectMember).where(
                    ProjectMember.project_id == project_id,
                    ProjectMember.user_id == update_data["assignee_id"],
                )
            )
            if not result2.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Assignee must be a project member")

    for field, value in update_data.items():
        setattr(task, field, value)

    await db.flush()
    result = await db.execute(
        select(Task).where(Task.id == task.id)
        .options(selectinload(Task.assignee), selectinload(Task.creator))
    )
    return result.scalar_one()


@router.delete("/projects/{project_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    membership: ProjectMember = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.project_id == project_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Only admin or task creator can delete
    if membership.role == UserRole.MEMBER and task.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only task creator or admin can delete tasks")

    await db.delete(task)