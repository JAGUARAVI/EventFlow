import { useState } from 'react';
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Checkbox,
  Card,
  CardBody,
  Spinner,
} from '@heroui/react';
import { FileDown } from 'lucide-react';
import {
  generateLeaderboardPDF,
  generateMatchesPDF,
  generatePollsPDF,
  generateEventSummaryPDF,
  savePDF,
} from '../lib/pdfExport';

export default function PdfExportDialog({ event, teams, matches, polls, votes, isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [exports, setExports] = useState({
    leaderboard: true,
    matches: true,
    polls: false,
    summary: true,
  });

  const handleExport = async () => {
    if (!event) {
      alert('Event data is not loaded yet');
      return;
    }

    try {
      setLoading(true);

      const teamMap = {};
      teams?.forEach((t) => {
        teamMap[t.id] = t.name;
      });

      if (exports.leaderboard && teams && teams.length > 0) {
        const doc = generateLeaderboardPDF(event.name, teams);
        savePDF(doc, `leaderboard_${event.id}.pdf`);
      }

      if (exports.matches && matches && matches.length > 0) {
        const doc = generateMatchesPDF(event.name, matches, teamMap);
        savePDF(doc, `matches_${event.id}.pdf`);
      }

      if (exports.polls && polls && polls.length > 0) {
        const doc = generatePollsPDF(event.name, polls, votes || []);
        savePDF(doc, `polls_${event.id}.pdf`);
      }

      if (exports.summary) {
        const doc = generateEventSummaryPDF(event, teams, matches, polls);
        savePDF(doc, `summary_${event.id}.pdf`);
      }

      if (onClose) onClose();
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to export PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose} size="md">
      <ModalContent>
        <ModalHeader>Export to PDF</ModalHeader>

        <ModalBody className="gap-4">
          <p className="text-sm text-default-600">
            Select what to include in your PDF exports
          </p>

          <Card isBlurred>
            <CardBody className="gap-3">
              <Checkbox
                isSelected={exports.summary}
                onChange={(e) => setExports({ ...exports, summary: e.target.checked })}
              >
                <span className="text-sm">Event Summary</span>
              </Checkbox>

              <Checkbox
                isSelected={exports.leaderboard}
                onChange={(e) => setExports({ ...exports, leaderboard: e.target.checked })}
                isDisabled={!teams || teams.length === 0}
              >
                <span className="text-sm">
                  Leaderboard ({teams?.length || 0} teams)
                </span>
              </Checkbox>

              <Checkbox
                isSelected={exports.matches}
                onChange={(e) => setExports({ ...exports, matches: e.target.checked })}
                isDisabled={!matches || matches.length === 0}
              >
                <span className="text-sm">
                  Match Results ({matches?.length || 0} matches)
                </span>
              </Checkbox>

              <Checkbox
                isSelected={exports.polls}
                onChange={(e) => setExports({ ...exports, polls: e.target.checked })}
                isDisabled={!polls || polls.length === 0}
              >
                <span className="text-sm">
                  Poll Results ({polls?.length || 0} polls)
                </span>
              </Checkbox>
            </CardBody>
          </Card>

          <p className="text-xs text-default-600">
            Each selected item will be saved as a separate PDF file
          </p>
        </ModalBody>

        <ModalFooter>
          <Button color="default" onPress={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            color="primary"
            startContent={<FileDown size={16} />}
            onPress={handleExport}
            isLoading={loading}
            isDisabled={!exports.leaderboard && !exports.matches && !exports.polls && !exports.summary}
          >
            Export PDFs
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
