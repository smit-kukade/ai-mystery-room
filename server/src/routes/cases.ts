import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { createCaseSchema } from '@mystery/shared';
import { CaseModel } from '../models/Case.js';
import { generate } from '../services/gemini/client.js';
import { HttpError } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyCsrf, verifyOrigin } from '../middleware/csrf.js';

export const cases = Router();
function dto(c: any) {
  return { id: c.publicId, title: c.title, synopsis: c.synopsis, premise: c.premise, incident: c.incident, suspects: c.suspects, timeline: c.timeline,
    evidence: c.evidence.map((e: any) => ({ ...e, ...(e.type === 'image' ? { media: { kind: 'none', isSimulated: true, altText: 'Simulated image evidence; text artifact only.' } } : {}) })),
    difficulty: c.difficulty, topic: c.topic ?? 'General Mystery', status: c.status, createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : undefined,
    ...(c.storedResult ? { result: c.storedResult } : {}) };
}
function historyDto(c: any) {
  return { id: c.publicId, title: c.title ?? 'Untitled mystery', synopsis: c.synopsis ?? '', premise: c.premise, topic: c.topic ?? 'General Mystery',
    status: c.status ?? 'investigating', createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : undefined };
}

cases.use(requireAuth);
cases.post('/', verifyOrigin, verifyCsrf, async (req, res, next) => {
  try {
    const parsed = createCaseSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'INVALID_PROMPT', parsed.error.issues[0]?.message ?? 'Please check the case details.');
    if (/\b(real person|actual person|my (boss|neighbor|ex|coworker)|real surveillance|spy on|non-fictional evidence)\b/i.test(parsed.data.premise)) throw new HttpError(400, 'FICTIONAL_CONTENT_ONLY', 'Use a fully fictional scenario. Real people and real surveillance are not allowed.');
    const generated = await generate(parsed.data);
    const record = await CaseModel.create({ ownerId: req.userId, publicId: randomBytes(24).toString('base64url'), title: generated.title, synopsis: generated.synopsis,
      premise: parsed.data.premise, difficulty: parsed.data.difficulty, topic: parsed.data.topic, theme: parsed.data.theme, incident: generated.incident,
      suspects: generated.suspects, timeline: generated.timeline, evidence: generated.evidence, solutionPrivate: generated.solution, status: 'investigating' });
    res.status(201).json({ case: dto(record) });
  } catch (error) { next(error); }
});
cases.get('/', async (req, res, next) => {
  try {
    const saved = await CaseModel.find({ ownerId: req.userId }).select('publicId title synopsis premise topic status createdAt').sort({ createdAt: -1 }).lean();
    res.json({ cases: saved.map(historyDto) });
  } catch (error) { next(error); }
});
cases.get('/:caseId', async (req, res, next) => {
  try {
    const c = await CaseModel.findOne({ publicId: req.params.caseId, ownerId: req.userId }).lean();
    if (!c) throw new HttpError(404, 'CASE_NOT_FOUND', 'This mystery could not be found.');
    res.json({ case: dto(c) });
  } catch (error) { next(error); }
});
cases.post('/:caseId/accusation', verifyOrigin, verifyCsrf, async (req, res, next) => {
  try {
    const { suspectId, reasoning } = req.body ?? {};
    if (typeof suspectId !== 'string' || (reasoning !== undefined && (typeof reasoning !== 'string' || reasoning.length > 500))) throw new HttpError(400, 'INVALID_ACCUSATION', 'Choose one suspect and keep your explanation under 500 characters.');
    const ownerFilter = { publicId: req.params.caseId, ownerId: req.userId };
    const c = await CaseModel.findOne(ownerFilter);
    if (!c) throw new HttpError(404, 'CASE_NOT_FOUND', 'This mystery could not be found.');
    if (c.storedResult) return res.json({ result: c.storedResult });
    if (!c.suspects.some(s => s.id === suspectId)) throw new HttpError(400, 'INVALID_SUSPECT', 'Choose a suspect from this case.');
    const correct = suspectId === c.solutionPrivate.culpritSuspectId;
    const culprit = c.suspects.find(s => s.id === c.solutionPrivate.culpritSuspectId)!;
    const result = { correct, selectedSuspectId: suspectId, culprit: { id: culprit.id, name: culprit.name }, explanation: c.solutionPrivate.explanation,
      supportingEvidenceIds: c.solutionPrivate.supportingEvidenceIds, alternativeExplanation: c.solutionPrivate.alternativeExplanation };
    const updated = await CaseModel.findOneAndUpdate({ ...ownerFilter, storedResult: { $exists: false } },
      { $set: { accusation: { suspectId, reasoning, correct, submittedAt: new Date() }, storedResult: result, ...(correct ? { status: 'solved' } : {}) } }, { new: true });
    const stored = updated?.storedResult ?? (await CaseModel.findOne(ownerFilter))?.storedResult;
    if (!stored) throw new HttpError(409, 'ACCUSATION_CONFLICT', 'The investigation changed. Reload the case and try again.');
    return res.json({ result: stored });
  } catch (error) { next(error); }
});
