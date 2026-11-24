import { NextRequest, NextResponse } from 'next/server';
import { listProjects, upsertProject, RepoError } from '@/lib/repo';
import { isStudioRequest } from '@/lib/studio';
import type { Project } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const projects = await listProjects();
    return NextResponse.json({ projects });
  } catch (e) {
    const err = e as RepoError;
    return NextResponse.json({ error: err.code || 'PROJECTS_READ', message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isStudioRequest(req)) return NextResponse.json({ error: 'STUDIO_ONLY', message: 'Enter the studio passcode first.' }, { status: 401 });
  try {
    const project = await req.json() as Project;
    if (!project || typeof project.id !== 'string' || typeof project.slug !== 'string') {
      return NextResponse.json({ error: 'BAD_PAYLOAD', message: 'Project needs at least id and slug.' }, { status: 400 });
    }
    const saved = await upsertProject(project);
    return NextResponse.json({ project: saved });
  } catch (e) {
    const err = e as RepoError;
    const status = err.code === 'SUPABASE_NOT_CONNECTED' ? 503 : 500;
    return NextResponse.json({ error: err.code || 'PROJECT_WRITE', message: err.message }, { status });
  }
}
