import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import type { RecordIndex } from '../exploring/record-summaries/record-index';
import { chipLabel } from './chips';
import type { Attachment } from './images';
import type { ChatSkill, QueuedMessage } from './types';

// The parts around the message box: the records the Owner pointed at (LA-PLT-UC22-R01), the images waiting to go (UC22-R05), the
// messages queued while Claude works (UC22-R04) and the "/" list of skills (UC22-R02).

/** The records attached with "Ask Claude about this", one chip each, removable. */
export function PointedChips({ ids, index, onRemove }: { ids: readonly string[]; index: RecordIndex | null; onRemove: (id: string) => void }) {
  if (!ids.length) return null;
  return (
    <ul className="chat-pointed" aria-label="Records attached to your message">
      {ids.map((id) => (
        <li key={id} className="chat-focus-chip chat-pointed-chip">
          <Icon name="graph" size={14} />
          <span className="chat-focus-label" title="Sent with your message: Claude is asked about this record">{chipLabel(index, id)}</span>
          <Button variant="icon" className="chat-focus-remove" label={`Leave out: ${chipLabel(index, id)}`} onClick={() => onRemove(id)}>
            <Icon name="x" size={12} />
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** The images waiting to go with the message, each a thumbnail that can be taken out. */
export function Attachments({ items, onRemove }: { items: readonly Attachment[]; onRemove: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <ul className="chat-attachments" aria-label="Images attached to your message">
      {items.map((a, n) => (
        <li key={a.id} className="chat-attachment">
          <img src={a.preview} alt={`Image ${n + 1} of ${items.length}`} />
          <Button variant="icon" className="chat-attachment-remove" label={`Remove image ${n + 1}`} onClick={() => onRemove(a.id)}>
            <Icon name="x" size={12} />
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** The messages typed while Claude works, in the order they will go, each removable until it does. */
export function QueueList({ queue, onRemove }: { queue: readonly QueuedMessage[]; onRemove: (id: string) => void }) {
  if (!queue.length) return null;
  return (
    <section className="chat-queue" aria-label="Messages waiting for Claude">
      <p className="chat-queue-title">Waiting for Claude ({queue.length})</p>
      <ol className="chat-queue-list">
        {queue.map((m) => (
          <li key={m.id} className="chat-queued">
            <span className="chat-queued-text">{m.text}{m.images > 0 && <small> · {m.images === 1 ? '1 image' : `${m.images} images`}</small>}</span>
            <Button variant="icon" className="chat-queued-remove" label={`Remove from the queue: ${m.text.slice(0, 40)}`} onClick={() => onRemove(m.id)}>
              <Icon name="x" size={12} />
            </Button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The "/" list: the skills and commands matching what is typed, with their descriptions; Up and Down move, Tab or Enter pick. */
export function SkillList({ skills, active, onPick, onHover }: { skills: readonly ChatSkill[]; active: number; onPick: (skill: ChatSkill) => void; onHover: (at: number) => void }) {
  return (
    <ul id="chat-skills" className="chat-skills" role="listbox" aria-label="Skills and slash commands">
      {skills.length === 0 && <li className="chat-skill-none hint" role="presentation">No skill or command matches.</li>}
      {skills.map((s, n) => (
        <li key={s.name} id={`chat-skill-${n}`} role="option" aria-selected={n === active} className={`chat-skill${n === active ? ' is-active' : ''}`} onMouseMove={() => onHover(n)} onMouseDown={(e) => { e.preventDefault(); onPick(s); }}>
          <span className="chat-skill-name">/{s.name}</span>
          {s.description && <span className="chat-skill-description">{s.description}</span>}
        </li>
      ))}
    </ul>
  );
}
