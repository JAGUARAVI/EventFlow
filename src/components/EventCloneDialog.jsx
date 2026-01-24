import { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Checkbox,
  Card,
  CardBody,
  Spinner,
} from '@heroui/react';
import { Copy } from 'lucide-react';
import { cloneEvent, getEventForClonePreview } from '../lib/eventClone';

export default function EventCloneDialog({ event, isOpen, onOpenChange, onCloneSuccess }) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [newName, setNewName] = useState(`${event?.name} (Copy)`);
  const [cloneOptions, setCloneOptions] = useState({
    cloneTeams: true,
    cloneJudges: true,
    cloneMatches: false,
    clonePolls: false,
  });

  const handleOpenChange = (isOpen) => {
    if (isOpen) {
      loadPreview();
    } else {
      setPreview(null);
    }
    onOpenChange(isOpen);
  };

  const loadPreview = async () => {
    try {
      setLoading(true);
      const data = await getEventForClonePreview(event.id);
      setPreview(data);
    } catch (err) {
      console.error('Failed to load clone preview:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async () => {
    try {
      setLoading(true);
      const newEventId = await cloneEvent(event.id, newName, cloneOptions);

      // Redirect to new event
      onCloneSuccess(newEventId);
      onOpenChange(false);
    } catch (err) {
      console.error('Clone failed:', err);
      alert('Failed to clone event: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={handleOpenChange} size="lg">
      <ModalContent>
        <ModalHeader>Clone Event</ModalHeader>
        <ModalBody className="gap-4">
          <Input
            label="New Event Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Event name..."
          />

          {loading ? (
            <div className="flex justify-center p-4">
              <Spinner />
            </div>
          ) : preview ? (
            <>
              <Card isBlurred>
                <CardBody>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>Original Event:</strong> {preview.event.name}
                    </p>
                    <p>
                      <strong>Teams:</strong> {preview.teamCount}
                    </p>
                    <p>
                      <strong>Judges:</strong> {preview.judgeCount}
                    </p>
                    <p>
                      <strong>Matches:</strong> {preview.matchCount}
                    </p>
                    <p>
                      <strong>Polls:</strong> {preview.pollCount}
                    </p>
                  </div>
                </CardBody>
              </Card>

              <div className="space-y-3">
                <h4 className="font-semibold text-sm">What to clone:</h4>

                <Checkbox
                  isSelected={cloneOptions.cloneTeams}
                  onChange={(e) =>
                    setCloneOptions({ ...cloneOptions, cloneTeams: e.target.checked })
                  }
                >
                  <span className="text-sm">
                    Teams ({preview.teamCount}) - Scores will be reset to 0
                  </span>
                </Checkbox>

                <Checkbox
                  isSelected={cloneOptions.cloneJudges}
                  onChange={(e) =>
                    setCloneOptions({ ...cloneOptions, cloneJudges: e.target.checked })
                  }
                >
                  <span className="text-sm">Judges ({preview.judgeCount})</span>
                </Checkbox>

                <Checkbox
                  isSelected={cloneOptions.cloneMatches}
                  onChange={(e) =>
                    setCloneOptions({ ...cloneOptions, cloneMatches: e.target.checked })
                  }
                  isDisabled={!cloneOptions.cloneTeams}
                >
                  <span className="text-sm">
                    Matches ({preview.matchCount}) - Requires teams to be cloned
                  </span>
                </Checkbox>

                <Checkbox
                  isSelected={cloneOptions.clonePolls}
                  onChange={(e) =>
                    setCloneOptions({ ...cloneOptions, clonePolls: e.target.checked })
                  }
                  isDisabled={!cloneOptions.cloneTeams}
                >
                  <span className="text-sm">
                    Polls ({preview.pollCount}) - Requires teams to be cloned
                  </span>
                </Checkbox>
              </div>
            </>
          ) : null}
        </ModalBody>

        <ModalFooter>
          <Button color="default" onPress={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            color="primary"
            startContent={<Copy size={16} />}
            onPress={handleClone}
            isLoading={loading}
            isDisabled={!newName.trim() || !preview}
          >
            Clone Event
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
