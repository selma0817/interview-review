import { z } from 'zod';
import type { Bank, Question } from '../types';
// Strict objects: a stray or misspelled field (say, a v1 `grading`) fails validation instead of being carried along
const source=z.object({path:z.string().min(1),heading:z.string().min(1),blob_sha:z.string().regex(/^[0-9a-f]{40}$/,'blob_sha must be a 40-character git hash'),url:z.string().url()}).strict();
const check=z.enum(['pass','n/a','not_run']);
const common={id:z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/,'id must be lowercase letters, digits and dashes'),version:z.number().int().positive(),topic:z.string().min(1),difficulty:z.enum(['easy','medium','hard']),created:z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'created must be YYYY-MM-DD'),question:z.string().min(1),answer:z.string().min(1),explanation:z.string(),sources:z.array(source).min(1),provenance:z.string().min(1),checks:z.object({grounded:check,blind_answer:check,code_run:check}).strict(),rubric:z.array(z.string()).optional(),extension_note:z.string().optional(),code_language:z.string().optional()};
export const cardSchema=z.discriminatedUnion('type',[
  z.object({...common,type:z.literal('single_choice'),options:z.array(z.object({id:z.string().min(1),text:z.string()}).strict()).min(2)}).strict(),
  z.object({...common,type:z.literal('flashcard')}).strict(),
  z.object({...common,type:z.literal('code_reading')}).strict(),
  z.object({...common,type:z.literal('short_answer')}).strict()
]);
const schema=z.object({schema_version:z.literal('2.0.0'),built_at:z.string(),questions:z.array(cardSchema)}).strict();
export function checkOptions(q:Question){if(q.type!=='single_choice')return;const optionIds=q.options.map(o=>o.id);if(new Set(optionIds).size!==optionIds.length)throw new Error(`Duplicate option ID in ${q.id}`);if(!optionIds.includes(q.answer))throw new Error(`Correct option ${q.answer} is missing in ${q.id}`);}
export function parseBank(input:unknown):Bank { const bank=schema.parse(input) as Bank; const ids=new Set<string>(); for(const q of bank.questions){if(ids.has(q.id)) throw new Error(`Duplicate question ID: ${q.id}`);ids.add(q.id);checkOptions(q);} return bank; }
export async function loadBank(signal?:AbortSignal){const response=await fetch(`${import.meta.env.BASE_URL}questions.json`,{signal});if(!response.ok)throw new Error(`Could not load question bank (HTTP ${response.status}). Rebuild with npm run bank:build.`);try{return parseBank(await response.json())}catch(error){throw new Error(`Question bank validation failed: ${error instanceof Error?error.message:'invalid JSON'}`)}}
