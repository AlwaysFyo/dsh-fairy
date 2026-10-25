import { createFairyDiagnostics } from 'dsh-fairy-next-contracts/diagnostics';

export const name = 'dsh-fairy-next-startup';
const diagnostics = createFairyDiagnostics(name);

export function apply() {
  return diagnostics.guard('apply', () => undefined, { surface: 'host' });
}
