import { z } from 'zod';
import type { Bank } from '../types';
const source=z.object({path:z.string(),heading:z.string(),blob_sha:z.string(),url:z.string().url()}).passthrough();
const common={id:z.string().min(1),version:z.number().int().positive(),topic:z.string().min(1),difficulty:z.enum(['easy','medium','hard']),language:z.string(),question:z.string(),answer:z.string(),explanation:z.string(),sources:z.array(source),review_status:z.string(),rubric:z.array(z.string()).optional(),extension_note:z.string().optional(),code_language:z.string().optional()};
const question=z.discriminatedUnion('type',[
  z.object({...common,type:z.literal('single_choice'),grading:z.literal('exact_option_id'),options:z.array(z.object({id:z.string().min(1),text:z.string()})).min(2)}).passthrough(),
  z.object({...common,type:z.literal('flashcard'),grading:z.literal('self_assessment')}).passthrough(),
  z.object({...common,type:z.literal('code_reading'),grading:z.literal('self_assessment')}).passthrough(),
  z.object({...common,type:z.literal('short_answer'),grading:z.literal('self_assessment')}).passthrough()
]);
const schema=z.object({schema_version:z.literal('1.0.0'),title:z.string(),created_date:z.string(),source_repository:z.string(),source_commit:z.string(),generation_method:z.string(),review_status:z.string(),questions:z.array(question)}).passthrough();
export function parseBank(input:unknown):Bank { const bank=schema.parse(input) as Bank; const ids=new Set<string>(); for(const q of bank.questions){if(ids.has(q.id)) throw new Error(`Duplicate question ID: ${q.id}`);ids.add(q.id);if(q.type==='single_choice'){const optionIds=q.options.map(o=>o.id);if(new Set(optionIds).size!==optionIds.length)throw new Error(`Duplicate option ID in ${q.id}`);if(!optionIds.includes(q.answer))throw new Error(`Correct option ${q.answer} is missing in ${q.id}`)}} return bank; }
export async function loadBank(signal?:AbortSignal){const response=await fetch(`${import.meta.env.BASE_URL}questions.json`,{signal});if(!response.ok)throw new Error(`Could not load question bank (HTTP ${response.status}). Check public/questions.json.`);try{return parseBank(await response.json())}catch(error){throw new Error(`Question bank validation failed: ${error instanceof Error?error.message:'invalid JSON'}`)}}
