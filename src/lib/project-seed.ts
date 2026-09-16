import { uid } from './id'
import type { Project, ProjectActivity, ProjectBlocker, ProjectDecision, ProjectMilestone, Task, WaitingOn } from './types'

export function seedProjectBundle(owner: string) {
  const t1 = uid()
  const t2 = uid()
  const t3 = uid()
  const now = new Date().toISOString()
  const day = now.slice(0, 10)
  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString()

  const mkMs = (
    projectId: string,
    names: string[],
    current: number,
  ): ProjectMilestone[] =>
    names.map((name, i) => ({
      id: uid(),
      projectId,
      name,
      owner,
      plannedEnd: undefined,
      status: i < current ? 'complete' : i === current ? 'current' : 'upcoming',
      criticalPath: true,
      sortOrder: i,
      notes: '',
      dependsOn: i ? [] : [],
    }))

  const truckMs = mkMs(t1, [
    'LLC + EIN',
    'Business Banking',
    'Funding Plan',
    'Secure Financing',
    'Purchase Truck',
    'Insurance',
    'Driver Onboarding',
    'First Dispatch',
    'First Paid Load',
  ], 3)
  truckMs[4]!.dependsOn = [truckMs[3]!.id]
  truckMs[5]!.dependsOn = [truckMs[4]!.id]
  truckMs[6]!.dependsOn = [truckMs[4]!.id]
  truckMs[7]!.dependsOn = [truckMs[5]!.id, truckMs[6]!.id]
  truckMs[8]!.dependsOn = [truckMs[7]!.id]
  truckMs[3]!.status = 'blocked'
  ;['2026-09-01', '2026-09-08', '2026-09-20', '2026-10-04', '2026-10-10', '2026-10-16', '2026-10-20', '2026-10-25', '2026-10-30'].forEach((d, i) => {
    if (!truckMs[i]) return
    truckMs[i]!.plannedEnd = d
    if (i < 3) truckMs[i]!.actualEnd = d
  })
  truckMs[3]!.plannedEnd = day

  const sunMs = mkMs(t2, ['State Licensing', 'Patch Approval', 'First Contract'], 0)
  sunMs[1]!.dependsOn = [sunMs[0]!.id]
  sunMs[2]!.dependsOn = [sunMs[1]!.id]

  const bssMs = mkMs(t3, ['Brand System', 'Website Launch', 'Go-to-market'], 1)

  const projects: Project[] = [
    {
      id: t1,
      name: 'First Truck Operational',
      company: 'Brivaus Trucking',
      owner,
      objective: 'Put the first company truck into revenue-producing operation.',
      definitionOfDone: 'Truck purchased, insured, driver onboarded, compliance completed and first paid load successfully delivered.',
      successMetric: 'First revenue-producing load completed by October 30.',
      why: 'No active revenue-producing truck.',
      constraints: 'Cash reserve cannot fall below $20,000.',
      problem: 'Company currently has no active revenue-producing truck.',
      desiredOutcome: 'First truck operating profitably.',
      assumptions: 'Financing approval within 10 days.',
      killPivot: 'Financing cost exceeds predefined profitability threshold.',
      state: 'active',
      priority: 3,
      deadline: '2026-10-30',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: t2,
      name: 'Suncrest First Contract',
      company: 'Suncrest Support Services',
      owner,
      objective: 'Land and staff the first Suncrest support contract.',
      definitionOfDone: 'Licensing complete, patch approved, first contract signed.',
      successMetric: 'Signed contract in hand.',
      why: 'Open the Suncrest line of business.',
      constraints: 'Must remain compliant with state rules.',
      problem: 'No live contract yet.',
      desiredOutcome: 'First contract operating.',
      assumptions: 'Patch approval within the week.',
      killPivot: 'Licensing denied without a viable path.',
      state: 'active',
      priority: 2,
      deadline: '2026-10-15',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: t3,
      name: 'BSS Express Rebrand',
      company: 'BSS Express',
      owner,
      objective: 'Ship the rebranded BSS Express site and identity.',
      definitionOfDone: 'Website live, brand system applied, launch announced.',
      successMetric: 'Website launch complete.',
      why: 'Identity and site no longer match the operating company.',
      constraints: 'Do not take operations offline.',
      problem: 'Brand lagging the business.',
      desiredOutcome: 'Coherent public identity.',
      assumptions: 'Copy and assets ready.',
      killPivot: 'Launch blocked more than 14 days.',
      state: 'active',
      priority: 2,
      deadline: '2026-10-10',
      createdAt: now,
      updatedAt: now,
    },
  ]

  const blocker: ProjectBlocker = {
    id: uid(),
    projectId: t1,
    milestoneId: truckMs[3]!.id,
    title: 'Bank requesting additional documentation',
    description: 'Underwriting asked for extra packets before financing can clear.',
    owner,
    startedAt: twoDaysAgo,
    expectedResolution: day,
    severity: 'high',
    delayDays: 2,
    isPrimary: true,
  }
  projects[0]!.primaryBottleneckId = blocker.id

  const decision: ProjectDecision = {
    id: uid(),
    projectId: t1,
    milestoneId: truckMs[3]!.id,
    title: 'Approve $18,500 down payment',
    description: 'Down payment required to lock the truck once financing clears.',
    requestedBy: owner,
    owner,
    requestedAt: now,
    deadline: day,
    status: 'pending',
    impactIfDelayed: '+7 days on first load',
    context: 'Tied to Secure Financing.',
  }

  const waiting: WaitingOn[] = [
    {
      id: uid(),
      projectId: t2,
      person: 'Patch desk',
      deliverable: 'Patch approval',
      requestedAt: now,
      dueAt: day,
      status: 'open',
      importance: 'high',
    },
  ]

  const activity: ProjectActivity[] = [
    { id: uid(), projectId: t1, type: 'activated', description: 'Project activated.', createdAt: now },
    { id: uid(), projectId: t1, type: 'blocker', description: 'Bank documentation requested.', createdAt: now },
    { id: uid(), projectId: t1, type: 'risk', description: 'Financing milestone marked at risk.', createdAt: now },
  ]

  const tasks: Task[] = [
    {
      id: uid(),
      title: 'Send remaining bank documentation',
      notes: 'Tied to Secure Financing.',
      listId: 'work',
      completed: false,
      due: day,
      priority: 3,
      createdAt: now,
      updatedAt: now,
      subtasks: [],
      blocked: true,
      projectId: t1,
      milestoneId: truckMs[3]!.id,
    },
    {
      id: uid(),
      title: 'Build truck shortlist',
      notes: 'Can run in parallel with financing.',
      listId: 'work',
      completed: false,
      due: day,
      priority: 2,
      createdAt: now,
      updatedAt: now,
      subtasks: [],
      projectId: t1,
      milestoneId: truckMs[4]!.id,
    },
    {
      id: uid(),
      title: 'Finish licensing submission',
      notes: 'Current Suncrest milestone.',
      listId: 'work',
      completed: false,
      due: day,
      priority: 3,
      createdAt: now,
      updatedAt: now,
      subtasks: [],
      projectId: t2,
      milestoneId: sunMs[0]!.id,
    },
  ]

  return {
    projects,
    milestones: [...truckMs, ...sunMs, ...bssMs],
    workstreams: [
      { id: uid(), projectId: t1, name: 'Finance', owner },
      { id: uid(), projectId: t1, name: 'Operations', owner },
      { id: uid(), projectId: t1, name: 'Compliance', owner },
      { id: uid(), projectId: t1, name: 'Hiring', owner },
    ],
    decisions: [decision],
    blockers: [blocker],
    waiting,
    activity,
    tasks,
  }
}
