import { useState } from "react";
import {
    Button,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Tabs,
    Tab,
    Textarea,
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
    Card,
    CardBody,
    Divider,
    Select,
    SelectItem,
} from "@heroui/react";
import { Download, Upload } from "lucide-react";
import {
    exportTeamsToCSV,
    exportEventToCSV,
    exportMatchesToCSV,
    exportPollsToCSV,
    importTeamsFromCSV,
    importTeamsWithMetadataFromCSV,
} from "../lib/csvUtils";

export default function CsvManager({
    event,
    teams,
    matches,
    polls,
    votes,
    metadataTemplate,
    onImportTeams,
    isOpen,
    onClose,
}) {
    const [activeTab, setActiveTab] = useState("export");
    const [exportFormat, setExportFormat] = useState("simple");
    const [importCSV, setImportCSV] = useState("");
    const [importPreview, setImportPreview] = useState([]);
    const [importError, setImportError] = useState("");

    const handleExportTeams = () => {
        const csv = exportTeamsToCSV(teams, exportFormat);
        downloadCSV(csv, `teams_${event.id}.csv`);
    };

    const handleExportEvent = () => {
        const csv = exportEventToCSV(event);
        downloadCSV(csv, `event_${event.id}.csv`);
    };

    const handleExportMatches = () => {
        const teamMap = {};
        teams.forEach((t) => {
            teamMap[t.id] = t.name;
        });
        const csv = exportMatchesToCSV(matches, teamMap);
        downloadCSV(csv, `matches_${event.id}.csv`);
    };

    const handleExportPolls = () => {
        const csv = exportPollsToCSV(polls, votes);
        downloadCSV(csv, `polls_${event.id}.csv`);
    };

    const handleImportCSVChange = (e) => {
        const content = e.target.value;
        setImportCSV(content);
        setImportError("");

        if (content.trim()) {
            try {
                const imported = metadataTemplate
                    ? importTeamsWithMetadataFromCSV(
                          content,
                          metadataTemplate.fields_json || [],
                      )
                    : importTeamsFromCSV(content);
                setImportPreview(imported);
            } catch (err) {
                setImportError(err.message);
                setImportPreview([]);
            }
        } else {
            setImportPreview([]);
        }
    };

    const handleConfirmImport = async () => {
        if (importPreview.length === 0) {
            setImportError("No valid teams to import");
            return;
        }

        try {
            await onImportTeams(importPreview);
            setImportCSV("");
            setImportPreview([]);
            if (onClose) onClose();
        } catch (err) {
            setImportError("Failed to import teams: " + err.message);
        }
    };

    return (
        <Modal isOpen={isOpen} onOpenChange={onClose} size="2xl">
            <ModalContent>
                <ModalHeader>CSV Import / Export</ModalHeader>
                <ModalBody>
                    <Tabs
                        selectedKey={activeTab}
                        onSelectionChange={setActiveTab}
                    >
                        <Tab key="export" title="Export Data">
                            <Card className="mt-4">
                                <CardBody className="gap-4">
                                    <div>
                                        <h4 className="font-semibold mb-2">
                                            Teams
                                        </h4>
                                        <div className="flex gap-2 mb-2">
                                            <Select
                                                label="Format"
                                                value={exportFormat}
                                                onChange={(e) =>
                                                    setExportFormat(
                                                        e.target.value,
                                                    )
                                                }
                                                className="max-w-xs"
                                                size="sm"
                                            >
                                                <SelectItem
                                                    key="simple"
                                                    value="simple"
                                                >
                                                    Simple (name, score)
                                                </SelectItem>
                                                <SelectItem
                                                    key="detailed"
                                                    value="detailed"
                                                >
                                                    Detailed (with metadata)
                                                </SelectItem>
                                            </Select>
                                        </div>
                                        <Button
                                            size="sm"
                                            startContent={
                                                <Download size={16} />
                                            }
                                            onPress={handleExportTeams}
                                            variant="bordered"
                                        >
                                            Export Teams
                                        </Button>
                                    </div>

                                    <Divider />

                                    <div>
                                        <h4 className="font-semibold mb-2">
                                            Event Summary
                                        </h4>
                                        <Button
                                            size="sm"
                                            startContent={
                                                <Download size={16} />
                                            }
                                            onPress={handleExportEvent}
                                            variant="bordered"
                                        >
                                            Export Event
                                        </Button>
                                    </div>

                                    <Divider />

                                    {matches && matches.length > 0 && (
                                        <>
                                            <div>
                                                <h4 className="font-semibold mb-2">
                                                    Match Results
                                                </h4>
                                                <Button
                                                    size="sm"
                                                    startContent={
                                                        <Download size={16} />
                                                    }
                                                    onPress={
                                                        handleExportMatches
                                                    }
                                                    variant="bordered"
                                                >
                                                    Export Matches
                                                </Button>
                                            </div>
                                            <Divider />
                                        </>
                                    )}

                                    {polls && polls.length > 0 && (
                                        <>
                                            <div>
                                                <h4 className="font-semibold mb-2">
                                                    Poll Results
                                                </h4>
                                                <Button
                                                    size="sm"
                                                    startContent={
                                                        <Download size={16} />
                                                    }
                                                    onPress={handleExportPolls}
                                                    variant="bordered"
                                                >
                                                    Export Polls
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </CardBody>
                            </Card>
                        </Tab>

                        <Tab key="import" title="Import Teams">
                            <Card className="mt-4">
                                <CardBody className="gap-4">
                                    <div>
                                        <p className="text-sm text-default-600 mb-2">
                                            Paste CSV content or upload a file.
                                            Required column:{" "}
                                            <strong>Team Name</strong>
                                            <br />
                                            Optional: Score, Description,{" "}
                                            {metadataTemplate?.fields_json
                                                ?.length > 0 &&
                                                "and custom fields"}
                                        </p>

                                        <Textarea
                                            label="CSV Content"
                                            placeholder="Team Name,Score,Description&#10;Alpha Team,50&#10;Beta Team,45"
                                            value={importCSV}
                                            onChange={handleImportCSVChange}
                                            minRows={6}
                                        />

                                        {importError && (
                                            <div className="text-danger text-sm mt-2">
                                                {importError}
                                            </div>
                                        )}
                                    </div>

                                    {importPreview.length > 0 && (
                                        <div>
                                            <h4 className="font-semibold mb-2">
                                                Preview ({importPreview.length}{" "}
                                                teams)
                                            </h4>
                                            <Table isStriped>
                                                <TableHeader>
                                                    <TableColumn>
                                                        Team Name
                                                    </TableColumn>
                                                    <TableColumn>
                                                        Score
                                                    </TableColumn>
                                                    <TableColumn>
                                                        Description
                                                    </TableColumn>
                                                </TableHeader>
                                                <TableBody>
                                                    {importPreview
                                                        .slice(0, 10)
                                                        .map((team, idx) => (
                                                            <TableRow key={idx}>
                                                                <TableCell>
                                                                    {team.name}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {team.score}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {
                                                                        team.description
                                                                    }
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                </TableBody>
                                            </Table>
                                            {importPreview.length > 10 && (
                                                <p className="text-sm text-default-600 mt-2">
                                                    ... and{" "}
                                                    {importPreview.length - 10}{" "}
                                                    more
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        </Tab>
                    </Tabs>
                </ModalBody>

                <ModalFooter>
                    {activeTab === "import" && (
                        <Button
                            color="primary"
                            startContent={<Upload size={16} />}
                            onPress={handleConfirmImport}
                            isDisabled={importPreview.length === 0}
                        >
                            Import Teams
                        </Button>
                    )}
                    <Button color="default" onPress={onClose}>
                        Close
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
