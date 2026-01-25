import { useState } from "react";
import {
    Button,
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Chip,
    Tooltip,
} from "@heroui/react";
import { Clock, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabase";

const STATUS_PIPELINE = [
    {
        value: "draft",
        label: "Draft",
        color: "default",
        description: "Event is being set up",
    },
    {
        value: "registration_open",
        label: "Registration Open",
        color: "warning",
        description: "Teams can register",
    },
    {
        value: "registration_closed",
        label: "Registration Closed",
        color: "info",
        description: "No more team registrations",
    },
    {
        value: "live",
        label: "Live",
        color: "danger",
        description: "Event is happening now",
    },
    {
        value: "completed",
        label: "Completed",
        color: "success",
        description: "Event has finished",
    },
    {
        value: "archived",
        label: "Archived",
        color: "secondary",
        description: "Event is archived",
    },
];

const STATUS_RESTRICTIONS = {
    draft: ["registration_open", "completed", "archived"],
    registration_open: ["registration_closed", "completed", "archived"],
    registration_closed: ["live", "completed", "archived"],
    live: ["completed", "archived"],
    completed: ["archived"],
    archived: [],
};

export default function EventStatusManager({
    event,
    onStatusChange,
    variant = "flat",
    size = "md",
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState(null);

    const currentStatusObj = STATUS_PIPELINE.find(
        (s) => s.value === event.status,
    );
    const availableTransitions = STATUS_RESTRICTIONS[event.status] || [];

    const handleStatusChange = async (newStatus) => {
        setSelectedStatus(newStatus);
        setIsOpen(true);
    };

    const confirmStatusChange = async () => {
        try {
            setLoading(true);

            const { error } = await supabase
                .from("events")
                .update({
                    status: selectedStatus,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", event.id);

            if (error) throw error;

            // Log to audit
            await supabase.from("event_audit").insert({
                event_id: event.id,
                action: "status_change",
                old_value: event.status,
                new_value: selectedStatus,
                changed_by: (await supabase.auth.getUser()).data.user?.id,
            });

            onStatusChange(selectedStatus);
            setIsOpen(false);
        } catch (err) {
            console.error("Failed to update status:", err);
            alert("Failed to update event status: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const getStatusRestrictions = (status) => {
        switch (status) {
            case "live":
                return ["Cannot edit teams or matches once event is live"];
            case "completed":
                return ["Event is locked. No further edits allowed"];
            case "archived":
                return ["Event is archived. View-only mode"];
            default:
                return [];
        }
    };

    const restrictions = getStatusRestrictions(event.status);

    return (
        <>
            <Dropdown>
                <DropdownTrigger>
                    <Button
                        startContent={<Clock size={16} />}
                        color={currentStatusObj?.color || "default"}
                        variant={variant}
                        size={size}
                    >
                        {currentStatusObj?.label || event.status}
                    </Button>
                </DropdownTrigger>

                <DropdownMenu
                    onAction={(key) => handleStatusChange(key)}
                    selectedKeys={new Set([event.status])}
                    disabledKeys={
                        new Set(
                            STATUS_PIPELINE.filter(
                                (s) => !availableTransitions.includes(s.value),
                            ).map((s) => s.value),
                        )
                    }
                >
                    {STATUS_PIPELINE.map((status) => (
                        <DropdownItem
                            key={status.value}
                            textValue={status.label}
                            description={status.description}
                            color={
                                status.value === event.status
                                    ? status.color
                                    : "default"
                            }
                        >
                            {status.label}
                        </DropdownItem>
                    ))}
                </DropdownMenu>
            </Dropdown>

            {restrictions.length > 0 && (
                <Tooltip
                    content={
                        <div className="gap-2">
                            {restrictions.map((r, i) => (
                                <p key={i} className="text-sm">
                                    {r}
                                </p>
                            ))}
                        </div>
                    }
                    color="warning"
                >
                    <AlertCircle size={16} className="text-warning" />
                </Tooltip>
            )}

            {/* Confirmation Modal */}
            <Modal isOpen={isOpen} onOpenChange={setIsOpen}>
                <ModalContent>
                    <ModalHeader>Confirm Status Change</ModalHeader>
                    <ModalBody>
                        <p className="text-sm">
                            Change event status from{" "}
                            <strong>{currentStatusObj?.label}</strong> to{" "}
                            <strong>
                                {
                                    STATUS_PIPELINE.find(
                                        (s) => s.value === selectedStatus,
                                    )?.label
                                }
                            </strong>
                            ?
                        </p>

                        {selectedStatus &&
                            getStatusRestrictions(selectedStatus).length >
                                0 && (
                                <div className="bg-warning-50 border border-warning rounded p-3">
                                    <p className="text-sm font-semibold text-warning mb-1">
                                        Important:
                                    </p>
                                    <ul className="text-sm text-warning space-y-1">
                                        {getStatusRestrictions(
                                            selectedStatus,
                                        ).map((r, i) => (
                                            <li key={i}>• {r}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                    </ModalBody>

                    <ModalFooter>
                        <Button
                            color="default"
                            onPress={() => setIsOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            color="primary"
                            onPress={confirmStatusChange}
                            isLoading={loading}
                            isDisabled={!selectedStatus}
                        >
                            Confirm
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}

export { STATUS_PIPELINE };
