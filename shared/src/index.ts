import { z } from 'zod';

export const evidenceTypes = ['chat','image','cctv','document','testimony'] as const;
export const difficultySchema = z.enum(['easy','medium','hard']);
export const createCaseSchema = z.object({
  premise: z.string().trim().min(30).max(1000),
  difficulty: difficultySchema.default('medium'),
  theme: z.string().trim().max(80).optional(),
  setting: z.string().trim().max(160).optional(),
  evidencePreferences: z.array(z.enum(evidenceTypes)).max(5).default([...evidenceTypes])
}).strict();

const bounded = (n=1600) => z.string().trim().min(1).max(n);
export const generationSchema = z.object({
  title: bounded(120), synopsis: bounded(500),
  incident: z.object({description:bounded(700),location:bounded(160),occurredAt:z.string().datetime()}).strict(),
  suspects: z.array(z.object({id:bounded(40),name:bounded(80),age:z.number().int().min(18).max(110),role:bounded(120),relationshipToIncident:bounded(240),motive:bounded(500),alibi:bounded(500)}).strict()).min(3).max(6),
  timeline: z.array(z.object({id:bounded(40),time:z.string().datetime(),description:bounded(500),relatedEvidenceIds:z.array(bounded(40))}).strict()).min(4).max(8),
  evidence: z.array(z.object({id:bounded(40),type:z.enum(evidenceTypes),title:bounded(120),summary:bounded(300),detail:bounded(1800),eventTime:z.string().datetime().nullable(),metadata:z.record(z.string(),z.string()).default({})}).strict()).min(5).max(10),
  solution: z.object({culpritSuspectId:bounded(40),explanation:bounded(1000),supportingEvidenceIds:z.array(bounded(40)).min(2),alternativeExplanation:bounded(700)}).strict()
}).strict();

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type GeneratedCase = z.infer<typeof generationSchema>;
export type Suspect = GeneratedCase['suspects'][number];
export type EvidenceItem = GeneratedCase['evidence'][number] & {media?:{kind:'none';isSimulated:true;altText:string}};
export type TimelineEvent = GeneratedCase['timeline'];
export interface PlayerCase { id:string; title:string; synopsis:string; incident:GeneratedCase['incident']; suspects:Suspect[]; timeline:GeneratedCase['timeline']; evidence:EvidenceItem[]; difficulty:'easy'|'medium'|'hard'; status:'investigating'|'solved'; createdAt:string; result?:Result }
export interface Result { correct:boolean; selectedSuspectId:string; culprit:{id:string;name:string}; explanation:string; supportingEvidenceIds:string[]; alternativeExplanation:string }
