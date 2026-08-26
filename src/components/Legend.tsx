import { TONE_DOT, TONE_LABEL, type Tone } from '@/lib/format';

const ORDER: Tone[] = ['green', 'amber', 'red', 'violet', 'grey'];

export function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500 dark:text-ink-400">
      {ORDER.map((tone) => (
        <span key={tone} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${TONE_DOT[tone]}`} />
          {TONE_LABEL[tone]}
        </span>
      ))}
    </div>
  );
}
