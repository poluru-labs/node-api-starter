export interface RubricCriterion {
  readonly id: string;
  readonly name: string;
  readonly maxPoints: number;
}

export interface Assignment {
  readonly id: string;
  readonly title: string;
  readonly criteria: readonly RubricCriterion[];
}

export interface CriterionScore {
  readonly criterionId: string;
  readonly points: number;
  readonly note: string;
}

export interface FeedbackComment {
  readonly criterionId: string;
  readonly name: string;
  readonly points: number;
  readonly maxPoints: number;
  readonly band: 'strength' | 'developing' | 'practice';
  readonly note: string;
}

export interface FeedbackReport {
  readonly id: string;
  readonly assignmentId: string;
  readonly student: string;
  readonly method: 'rubric-bands';
  readonly total: number;
  readonly maxPoints: number;
  readonly comments: readonly FeedbackComment[];
}

export function buildFeedback(
  assignment: Assignment,
  student: string,
  scores: readonly CriterionScore[],
  id: string,
): FeedbackReport {
  const byId = new Map(scores.map((score) => [score.criterionId, score]));
  const comments = assignment.criteria.map((criterion) => {
    const score = byId.get(criterion.id);
    const points = score?.points ?? 0;
    const ratio = criterion.maxPoints === 0 ? 0 : points / criterion.maxPoints;
    let band: FeedbackComment['band'] = 'practice';
    if (ratio >= 0.8) {
      band = 'strength';
    } else if (ratio >= 0.5) {
      band = 'developing';
    }
    return {
      criterionId: criterion.id,
      name: criterion.name,
      points,
      maxPoints: criterion.maxPoints,
      band,
      note: score?.note ?? '',
    };
  });
  return {
    id,
    assignmentId: assignment.id,
    student,
    method: 'rubric-bands',
    total: comments.reduce((sum, comment) => sum + comment.points, 0),
    maxPoints: assignment.criteria.reduce((sum, criterion) => sum + criterion.maxPoints, 0),
    comments,
  };
}
