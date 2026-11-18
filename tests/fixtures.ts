import type {Bank,Question} from '../src/types';

export const source={path:'Concepts/Note.md',heading:'Heading',blob_sha:'0'.repeat(40),url:'https://github.com/owner/vault/blob/abc/Concepts/Note.md'};
const base={version:1,difficulty:'easy' as const,created:'2026-11-05',question:'?',answer:'x',explanation:'',sources:[source],provenance:'test',checks:{grounded:'pass' as const,blind_answer:'n/a' as const,code_run:'n/a' as const}};

export const flashcard=(id:string,topic='Go',extra:Partial<Question>={}):Question=>({...base,id,topic,type:'flashcard',...extra} as Question);
export const multipleChoice=(id:string,topic='Go',extra:Partial<Question>={}):Question=>({...base,id,topic,type:'single_choice',answer:'A',options:[{id:'A',text:'a'},{id:'B',text:'b'}],checks:{...base.checks,blind_answer:'pass'},...extra} as Question);
export const bankOf=(questions:Question[]):Bank=>({schema_version:'2.0.0',built_at:'2026-11-18T00:00:00.000Z',questions});
