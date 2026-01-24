import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@heroui/react';

export default function AuditLog({ items = [], currentUserId }) {
  return (
    <Table aria-label="Audit log">
      <TableHeader>
        <TableColumn>TIME</TableColumn>
        <TableColumn>TEAM</TableColumn>
        <TableColumn>BEFORE</TableColumn>
        <TableColumn>AFTER</TableColumn>
        <TableColumn>DELTA</TableColumn>
        <TableColumn>BY</TableColumn>
      </TableHeader>
      <TableBody>
        {items.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
            <TableCell>{r.teams?.name ?? r.team_id}</TableCell>
            <TableCell>{(Number(r.points_before) || 0).toLocaleString()}</TableCell>
            <TableCell>{(Number(r.points_after) || 0).toLocaleString()}</TableCell>
            <TableCell>
              <span className={Number(r.delta) >= 0 ? 'text-success' : 'text-danger'}>
                {Number(r.delta) >= 0 ? '+' : ''}{(Number(r.delta) || 0).toLocaleString()}
              </span>
            </TableCell>
            <TableCell>{r.changed_by === currentUserId ? 'You' : (r.changed_by || '').slice(0, 8) + '…'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
