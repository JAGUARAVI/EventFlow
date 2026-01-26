import { useState, useMemo } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Chip,
  Tooltip,
  Pagination,
  useDisclosure,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { Search, Trash2, Edit3, MoreVertical, UserX } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function PollVoteManager({
  isOpen,
  onClose,
  poll,
  options = [],
  votes = [],
  eventId,
  userId,
  onRefresh,
}) {
  const [filterValue, setFilterValue] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editingVote, setEditingVote] = useState(null);
  const [editValue, setEditValue] = useState("");
  const rowsPerPage = 10;

  // Build option lookup
  const optionMap = useMemo(() => {
    const map = {};
    options.forEach((opt) => {
      map[opt.id] = opt;
    });
    return map;
  }, [options]);

  // Group votes by user to show complete user submissions
  const votesByUser = useMemo(() => {
    const grouped = {};
    votes.forEach((vote) => {
      if (!grouped[vote.user_id]) {
        grouped[vote.user_id] = [];
      }
      grouped[vote.user_id].push(vote);
    });
    return grouped;
  }, [votes]);

  // Create rows - one per user
  const rows = useMemo(() => {
    return Object.entries(votesByUser).map(([visitorId, userVotes]) => {
      // For simple polls: single vote
      // For ranked: multiple votes with ranks
      // For vote_to_points: multiple votes with values
      const firstVote = userVotes[0];
      return {
        visitorId,
        votes: userVotes,
        createdAt: firstVote?.created_at,
        summary: userVotes
          .map((v) => {
            const opt = optionMap[v.option_id];
            if (poll?.poll_type === "ranked") {
              return `#${v.rank}: ${opt?.label || "?"}`;
            } else if (poll?.poll_type === "vote_to_points") {
              return `${opt?.label || "?"}: ${v.value}pts`;
            }
            return opt?.label || "?";
          })
          .join(", "),
      };
    });
  }, [votesByUser, optionMap, poll?.poll_type]);

  // Filter
  const filteredRows = useMemo(() => {
    if (!filterValue) return rows;
    const lowerFilter = filterValue.toLowerCase();
    return rows.filter(
      (row) =>
        row.visitorId.toLowerCase().includes(lowerFilter) ||
        row.summary.toLowerCase().includes(lowerFilter)
    );
  }, [rows, filterValue]);

  const pages = Math.ceil(filteredRows.length / rowsPerPage);
  const displayRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [page, filteredRows]);

  const handleDeleteVote = async (vote) => {
    if (!confirm("Delete this vote?")) return;
    setLoading(true);
    try {
      const option = optionMap[vote.option_id];
      const { error } = await supabase.from("votes").delete().eq("id", vote.id);
      if (error) throw error;

      // Audit log
      await supabase.from("event_audit").insert({
        event_id: eventId,
        action: "vote.delete",
        entity_type: "vote",
        entity_id: vote.id,
        message: `Deleted vote for "${option?.label || "Unknown"}" in poll "${poll?.question}"`,
        created_by: userId,
        metadata: {
          poll_id: poll?.id,
          option_id: vote.option_id,
          voter_id: vote.user_id,
        },
      });

      onRefresh?.();
    } catch (err) {
      console.error("Failed to delete vote:", err);
      alert("Failed to delete vote: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllUserVotes = async (row) => {
    if (
      !confirm(`Delete all ${row.votes.length} votes from this user?`)
    )
      return;
    setLoading(true);
    try {
      const voteIds = row.votes.map((v) => v.id);
      const { error } = await supabase
        .from("votes")
        .delete()
        .in("id", voteIds);
      if (error) throw error;

      // Audit log
      await supabase.from("event_audit").insert({
        event_id: eventId,
        action: "vote.delete_user",
        entity_type: "vote",
        message: `Deleted all ${row.votes.length} votes from user in poll "${poll?.question}"`,
        created_by: userId,
        metadata: {
          poll_id: poll?.id,
          voter_id: row.visitorId,
          deleted_count: row.votes.length,
        },
      });

      onRefresh?.();
    } catch (err) {
      console.error("Failed to delete votes:", err);
      alert("Failed to delete votes: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditVote = (vote) => {
    setEditingVote(vote);
    if (poll?.poll_type === "vote_to_points") {
      setEditValue(String(vote.value || 0));
    } else if (poll?.poll_type === "ranked") {
      setEditValue(String(vote.rank || 1));
    }
  };

  const handleSaveEdit = async () => {
    if (!editingVote) return;
    setLoading(true);
    try {
      const option = optionMap[editingVote.option_id];
      const oldValue =
        poll?.poll_type === "vote_to_points"
          ? editingVote.value
          : editingVote.rank;
      const newValue = parseInt(editValue, 10);

      const updateData =
        poll?.poll_type === "vote_to_points"
          ? { value: newValue }
          : { rank: newValue };

      const { error } = await supabase
        .from("votes")
        .update(updateData)
        .eq("id", editingVote.id);
      if (error) throw error;

      // Audit log
      await supabase.from("event_audit").insert({
        event_id: eventId,
        action: "vote.update",
        entity_type: "vote",
        entity_id: editingVote.id,
        message: `Updated vote for "${option?.label || "Unknown"}" in poll "${poll?.question}" from ${oldValue} to ${newValue}`,
        created_by: userId,
        metadata: {
          poll_id: poll?.id,
          option_id: editingVote.option_id,
          voter_id: editingVote.user_id,
          old_value: oldValue,
          new_value: newValue,
        },
      });

      setEditingVote(null);
      onRefresh?.();
    } catch (err) {
      console.error("Failed to update vote:", err);
      alert("Failed to update vote: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="3xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h3>Manage Poll Votes</h3>
            <p className="text-sm text-default-500 font-normal">
              {poll?.question}
            </p>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="flex justify-between items-center gap-4">
                <Input
                  isClearable
                  className="w-full sm:max-w-[44%]"
                  placeholder="Search by user or vote..."
                  size="sm"
                  startContent={<Search className="text-default-300" size={16} />}
                  value={filterValue}
                  onClear={() => setFilterValue("")}
                  onValueChange={setFilterValue}
                />
                <Chip size="sm" variant="flat">
                  {votes.length} votes from {Object.keys(votesByUser).length}{" "}
                  users
                </Chip>
              </div>

              <Table
                aria-label="Poll votes"
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
                        onChange={setPage}
                      />
                    </div>
                  ) : null
                }
              >
                <TableHeader>
                  <TableColumn>USER</TableColumn>
                  <TableColumn>VOTE(S)</TableColumn>
                  <TableColumn>TIME</TableColumn>
                  <TableColumn align="end">ACTIONS</TableColumn>
                </TableHeader>
                <TableBody emptyContent="No votes yet">
                  {displayRows.map((row) => (
                    <TableRow key={row.visitorId}>
                      <TableCell>
                        <span className="font-mono text-xs text-default-500 truncate max-w-[120px] block">
                          {row.visitorId.substring(0, 8)}...
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.votes.map((vote) => {
                            const opt = optionMap[vote.option_id];
                            let label = opt?.label || "?";
                            if (poll?.poll_type === "ranked") {
                              label = `#${vote.rank}: ${label}`;
                            } else if (poll?.poll_type === "vote_to_points") {
                              label = `${label} (${vote.value}pts)`;
                            }
                            return (
                              <Chip
                                key={vote.id}
                                size="sm"
                                variant="flat"
                                endContent={
                                  <Dropdown>
                                    <DropdownTrigger>
                                      <button className="ml-1 p-0.5 hover:bg-default-200 rounded">
                                        <MoreVertical size={12} />
                                      </button>
                                    </DropdownTrigger>
                                    <DropdownMenu aria-label="Vote actions">
                                      {poll?.poll_type !== "simple" && (
                                        <DropdownItem
                                          key="edit"
                                          startContent={<Edit3 size={14} />}
                                          onPress={() => handleEditVote(vote)}
                                        >
                                          Edit{" "}
                                          {poll?.poll_type === "vote_to_points"
                                            ? "Points"
                                            : "Rank"}
                                        </DropdownItem>
                                      )}
                                      <DropdownItem
                                        key="delete"
                                        className="text-danger"
                                        color="danger"
                                        startContent={<Trash2 size={14} />}
                                        onPress={() => handleDeleteVote(vote)}
                                      >
                                        Delete Vote
                                      </DropdownItem>
                                    </DropdownMenu>
                                  </Dropdown>
                                }
                              >
                                {label}
                              </Chip>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-default-500">
                          {row.createdAt
                            ? new Date(row.createdAt).toLocaleString()
                            : "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Tooltip content="Delete all votes from this user">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            isLoading={loading}
                            onPress={() => handleDeleteAllUserVotes(row)}
                          >
                            <UserX size={16} />
                          </Button>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Vote Modal */}
      <Modal
        isOpen={!!editingVote}
        onClose={() => setEditingVote(null)}
        size="sm"
      >
        <ModalContent>
          <ModalHeader>
            Edit{" "}
            {poll?.poll_type === "vote_to_points" ? "Points" : "Rank"}
          </ModalHeader>
          <ModalBody>
            <Input
              type="number"
              label={
                poll?.poll_type === "vote_to_points"
                  ? "Points (0-10)"
                  : "Rank"
              }
              value={editValue}
              onValueChange={setEditValue}
              min={poll?.poll_type === "vote_to_points" ? 0 : 1}
              max={poll?.poll_type === "vote_to_points" ? 10 : options.length}
            />
            <p className="text-xs text-default-500">
              Option: {optionMap[editingVote?.option_id]?.label}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setEditingVote(null)}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleSaveEdit}
              isLoading={loading}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
