import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Input,
  Pagination,
  Button,
  Tooltip,
} from "@heroui/react";
import { useMemo, useState } from "react";
import { Search, RotateCcw } from "lucide-react";

function formatAction(item) {
  if (item.kind === "score") return "Score";
  if (item.action) return item.action;
  return "Event";
}

function formatMessage(item) {
  if (item.kind === "score") {
    const name = item.teams?.name ?? item.team_id ?? "Team";
    const delta = Number(item.delta) || 0;
    return `${name} ${delta >= 0 ? "+" : ""}${delta}`;
  }
  return item.message || "";
}

export default function AuditLog({ items = [], currentUserId, onUndo }) {
  const [filterValue, setFilterValue] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  const filteredItems = useMemo(() => {
    let filtered = [...items];

    if (filterValue) {
      const lowerCaseFilter = filterValue.toLowerCase();
      filtered = filtered.filter((item) => {
        const action = formatAction(item).toLowerCase();
        const message = formatMessage(item).toLowerCase();
        const by = (item.changed_by || item.created_by || "").toLowerCase();

        return (
          action.includes(lowerCaseFilter) ||
          message.includes(lowerCaseFilter) ||
          by.includes(lowerCaseFilter)
        );
      });
    }

    return filtered;
  }, [items, filterValue]);

  const pages = Math.ceil(filteredItems.length / rowsPerPage);

  const itemsToDisplay = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    return filteredItems.slice(start, end);
  }, [page, filteredItems]);

  return (
    <div className="space-y-4">
      <Input
        isClearable
        classNames={{
          base: "w-full sm:max-w-[44%]",
          inputWrapper: "border-1",
        }}
        placeholder="Search by action, message, or user..."
        size="sm"
        startContent={<Search className="text-default-300" size={16} />}
        value={filterValue}
        onClear={() => setFilterValue("")}
        onValueChange={setFilterValue}
      />
      <Table
        aria-label="Audit log"
        bottomContent={
          pages > 1 ? (
            <div className="flex w-full justify-center">
              <Pagination
                isCompact
                showControls
                showShadow
                color="primary"
                page={page}
                total={pages}
                onChange={(page) => setPage(page)}
              />
            </div>
          ) : null
        }
      >
        <TableHeader>
          <TableColumn>TIME</TableColumn>
          <TableColumn>ACTION</TableColumn>
          <TableColumn>DETAILS</TableColumn>
          <TableColumn>BY</TableColumn>
          {onUndo && <TableColumn align="end">ACTIONS</TableColumn>}
        </TableHeader>
        <TableBody emptyContent={"No logs found"}>
          {itemsToDisplay.map((r) => {
            const by = r.changed_by || r.created_by;
            return (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat">
                    {formatAction(r)}
                  </Chip>
                </TableCell>
                <TableCell>{formatMessage(r)}</TableCell>
                <TableCell>
                  {by === currentUserId ? "You" : by || "System"}
                </TableCell>
                {onUndo && (
                  <TableCell>
                    {r.kind === "score" && r.undo_id !== "undone" && (
                      <Tooltip content="Undo this change">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          onPress={() => onUndo(r)}
                        >
                          <RotateCcw size={16} />
                        </Button>
                      </Tooltip>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
