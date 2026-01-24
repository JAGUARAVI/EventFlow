import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip } from '@heroui/react';

function formatAction(item) {
  if (item.kind === 'score') return 'Score';
  if (item.action) return item.action;
  return 'Event';
}

function formatMessage(item) {
  if (item.kind === 'score') {
    const name = item.teams?.name ?? item.team_id ?? 'Team';
    const delta = Number(item.delta) || 0;
    return `${name} ${delta >= 0 ? '+' : ''}${delta}`;
  }
  return item.message || '';
}

export default function AuditLog({ items = [], currentUserId }) {
  return (
    <Table aria-label="Audit log">
      <TableHeader>
        <TableColumn>TIME</TableColumn>
        <TableColumn>ACTION</TableColumn>
        <TableColumn>DETAILS</TableColumn>
        <TableColumn>BY</TableColumn>
      </TableHeader>
      <TableBody>
        {items.map((r) => {
          const by = r.changed_by || r.created_by;
          return (
            <TableRow key={r.id}>
              <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
              <TableCell>
                <Chip size="sm" variant="flat">{formatAction(r)}</Chip>
              </TableCell>
              <TableCell>{formatMessage(r)}</TableCell>
              <TableCell>{by === currentUserId ? 'You' : (by || '').slice(0, 8) + '…'}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
