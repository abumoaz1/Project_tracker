import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.models import Project, ProjectMember, User, UserRole, Task
from app.schemas.schemas import (
    ProjectCreate, ProjectUpdate, ProjectOut, ProjectSummary,
    AddMemberRequest, UpdateMemberRole, MemberOut,
)
from app.core.deps import get_current_user, get_project_member, require_project_admin

router = APIRouter()


@router.get("/", response_model=List[ProjectSummary])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all projects the current user is a member of."""
    result = await db.execute(
        select(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id == current_user.id, Project.is_active == True)
        .options(selectinload(Project.members), selectinload(Project.tasks))
    )
    projects = result.scalars().all()

    summaries = []
    for p in projects:
        summaries.append(ProjectSummary(
            id=p.id,
            name=p.name,
            description=p.description,
            is_active=p.is_active,
            created_at=p.created_at,
            task_count=len(p.tasks),
            member_count=len(p.members),
        ))
    return summaries


@router.post("/", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new project. Creator is automatically added as admin."""
    project = Project(name=payload.name, description=payload.description)
    db.add(project)
    await db.flush()

    # Creator becomes admin
    membership = ProjectMember(
        project_id=project.id,
        user_id=current_user.id,
        role=UserRole.ADMIN,
    )
    db.add(membership)
    await db.flush()

    await db.refresh(project)
    result = await db.execute(
        select(Project)
        .where(Project.id == project.id)
        .options(selectinload(Project.members).selectinload(ProjectMember.user))
    )
    return result.scalar_one()


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: uuid.UUID,
    membership: ProjectMember = Depends(get_project_member),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id)
        .options(selectinload(Project.members).selectinload(ProjectMember.user))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    admin: ProjectMember = Depends(require_project_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    await db.flush()

    result = await db.execute(
        select(Project).where(Project.id == project_id)
        .options(selectinload(Project.members).selectinload(ProjectMember.user))
    )
    return result.scalar_one()


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    admin: ProjectMember = Depends(require_project_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)


# ── Members ───────────────────────────────────────────────────────────────────

@router.post("/{project_id}/members", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
async def add_member(
    project_id: uuid.UUID,
    payload: AddMemberRequest,
    admin: ProjectMember = Depends(require_project_admin),
    db: AsyncSession = Depends(get_db),
):
    # Find user by email
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check already member
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user.id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already a member")

    membership = ProjectMember(project_id=project_id, user_id=user.id, role=payload.role)
    db.add(membership)
    await db.flush()

    result = await db.execute(
        select(ProjectMember)
        .where(ProjectMember.project_id == project_id, ProjectMember.user_id == user.id)
        .options(selectinload(ProjectMember.user))
    )
    return result.scalar_one()


@router.patch("/{project_id}/members/{user_id}", response_model=MemberOut)
async def update_member_role(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: UpdateMemberRole,
    admin: ProjectMember = Depends(require_project_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProjectMember)
        .where(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
        .options(selectinload(ProjectMember.user))
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found")

    membership.role = payload.role
    await db.flush()
    return membership


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    admin: ProjectMember = Depends(require_project_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.delete(membership)