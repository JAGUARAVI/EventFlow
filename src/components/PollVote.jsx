import { useState, useEffect, useRef } from 'react';
import { Button, Slider, addToast, Modal, ModalContent, ModalBody, ModalHeader, useDisclosure, Image } from '@heroui/react';
import { motion } from 'framer-motion';
import { X, Plus, GripVertical, Maximize2 } from 'lucide-react';
import { supabase, withRetry } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function PollVote({ poll, options, onVoted, showQuestion = true, canJudge = false, canManage = false }) {
  const { user } = useAuth();
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [rankedOrdered, setRankedOrdered] = useState([]); // For ranked: list of option objects
  const [pointsMap, setPointsMap] = useState({}); // For vote_to_points: { optionId: number }

  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  
  const { isOpen: isImageOpen, onOpen: onImageOpen, onClose: onImageClose } = useDisclosure();
  const [previewImage, setPreviewImage] = useState('');

  const openImage = (url) => {
    setPreviewImage(url);
    onImageOpen();
  };

  useEffect(() => {
    if (poll?.id && user?.id) {
      checkVoted();
    }
  }, [poll?.id, user?.id]);

  useEffect(() => {
    // Initialize state based on poll type
    if (poll?.poll_type === 'ranked') {
      setRankedOrdered([]);
    } else if (poll?.poll_type === 'vote_to_points') {
      const initialMap = {};
      options.forEach((o) => (initialMap[o.id] = 0));
      setPointsMap(initialMap);
    }
  }, [poll?.poll_type, options]);

  const checkVoted = async () => {
    const { data: existingVotes } = await supabase
      .from('votes')
      .select('id, option_id, rank, value')
      .eq('poll_id', poll.id)
      .eq('user_id', user.id);

    if (existingVotes && existingVotes.length > 0) {
      setHasVoted(true);

      // Reconstruct state based on previous votes
      if (poll.poll_type === 'ranked') {
        const sorted = existingVotes.sort((a, b) => (a.rank || 0) - (b.rank || 0));
        // Need to find the option objects
        const reconstructions = sorted.map(v => options.find(o => o.id === v.option_id)).filter(Boolean);
        setRankedOrdered(reconstructions);
      } else if (poll.poll_type === 'vote_to_points') {
        const map = { ...pointsMap };
        existingVotes.forEach(v => {
          map[v.option_id] = v.value || 0;
        });
        setPointsMap(map);
      } else {
        // Simple
        if (existingVotes[0]) {
          setSelectedOptionId(existingVotes[0].option_id);
        }
      }
    } else {
      setHasVoted(false);
    }
  };

  const handleSimpleVote = async () => {
    if (!selectedOptionId) {
      addToast({ title: 'Select an option', severity: 'warning' });
      return;
    }
    await submitVotes([{ option_id: selectedOptionId }]);
  };

  const handleRankedVote = async () => {
    if (rankedOrdered.length === 0) {
      addToast({ title: 'Rank at least one option', severity: 'warning' });
      return;
    }
    // Prepare payload: { option_id, rank }
    const payload = rankedOrdered.map((opt, idx) => ({
      option_id: opt.id,
      rank: idx + 1,
    }));
    await submitVotes(payload);
  };

  const handlePointsVote = async () => {
    // Check if at least one option has points? Or allow all 0?
    // Let's assume user must engage.
    const hasPoints = Object.values(pointsMap).some((v) => v > 0);
    if (!hasPoints) {
      addToast({ title: 'Assign points to at least one option', severity: 'warning' });
      // return; // Allow 0 points if they really want? Maybe not.
      return;
    }
    const payload = options.map((opt) => ({
      option_id: opt.id,
      value: pointsMap[opt.id] || 0,
    }));
    await submitVotes(payload);
  };

  const submitVotes = async (votesPayload) => {
    if (!user?.id) {
      addToast({ title: 'Sign in to vote', severity: 'warning' });
      return;
    }

    setVoting(true);

    try {
      // Delete existing votes to avoid conflict (or just in case we allow revoting logic later)
      // RLS might block delete if not creator? No, usually users can delete own data.
      // Assuming policy: "Users can insert/delete their own votes"
      const { error: deleteError } = await withRetry(() =>
        supabase
          .from('votes')
          .delete()
          .match({ poll_id: poll.id, user_id: user.id })
      );

      if (deleteError) {
        console.warn('Error clearing previous votes:', deleteError);
      }

      // Insert new votes
      const rows = votesPayload.map((v) => ({
        poll_id: poll.id,
        user_id: user.id,
        option_id: v.option_id,
        rank: v.rank || 1,
        value: v.value || 0, // ensure value is set
      }));

      const { error } = await withRetry(() =>
        supabase.from('votes').insert(rows)
      );

      if (error) {
        if (error.code === '23505') {
          addToast({ title: 'Already voted', severity: 'info' });
          setHasVoted(true);
        } else {
          addToast({ title: 'Vote failed', description: error.message, severity: 'danger' });
        }
        return;
      }

      setHasVoted(true);
      addToast({ title: 'Vote recorded', severity: 'success' });
      onVoted?.();
    } finally {
      setVoting(false);
    }
  };

  if (poll?.status === 'closed') {
    return <p className="text-default-500 text-sm">This poll is closed.</p>;
  }

  // Check voting restrictions
  const restrictedTo = poll?.restricted_to;
  const canVote = !restrictedTo || restrictedTo === 'everyone' || 
    (restrictedTo === 'judges' && canJudge) || 
    (restrictedTo === 'managers' && canManage);

  if (!canVote) {
    const restrictionLabel = restrictedTo === 'judges' ? 'judges' : 'managers';
    return (
      <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg text-center">
        <p className="text-warning-700 text-sm">This poll is restricted to {restrictionLabel} only.</p>
      </div>
    );
  }

  // --- Render: Ranked Choice ---
  if (poll?.poll_type === 'ranked') {
    const unrankedOptions = options.filter(
      (o) => !rankedOrdered.find((r) => r.id === o.id)
    );

    return (
      <div className="space-y-4">
        {showQuestion && <p className="text-base font-semibold">{poll?.question}</p>}

        {/* Your Ranking List */}
        <div className="space-y-2">
          <p className="text-sm text-default-500">Your Ranking (Top is #1)</p>
          {rankedOrdered.length === 0 && (
            <div className="p-4 border border-dashed rounded-lg text-center text-default-400 text-sm">
              Tap options below to add them to your ranking
            </div>
          )}

          <div className="flex flex-col gap-2">
            {rankedOrdered.map((opt, idx) => (
              <motion.div
                key={opt.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
                  {idx + 1}
                </div>
                {opt.image_url && (
                    <div className="shrink-0 cursor-pointer" onClick={() => openImage(opt.image_url)}>
                        <img src={opt.image_url} alt="Option" className="w-10 h-10 object-cover rounded-md border border-default-200" />
                    </div>
                )}
                <span className="flex-1 font-medium">{opt.label}</span>
                {!hasVoted && (
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="danger"
                    onPress={() =>
                      setRankedOrdered((prev) => prev.filter((p) => p.id !== opt.id))
                    }
                  >
                    <X size={16} />
                  </Button>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Available Options */}
        {unrankedOptions.length > 0 && !hasVoted && (
          <div className="space-y-2 pt-2">
            <p className="text-sm text-default-500">Available Options</p>
            <div className="grid grid-cols-1 gap-2">
              {unrankedOptions.map((opt) => (
                <Button
                  key={opt.id}
                  variant="flat"
                  className="justify-start h-auto py-2"
                  onPress={() => setRankedOrdered((prev) => [...prev, opt])}
                >
                  <Plus size={16} className="mr-2" />
                  {opt.image_url && (
                        <div className="shrink-0 mr-2" onClick={(e) => { e.stopPropagation(); openImage(opt.image_url); }}>
                            <img src={opt.image_url} alt="Option" className="w-8 h-8 object-cover rounded-md border border-default-200" />
                        </div>
                   )}
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {!hasVoted ? (
          <Button
            color="primary"
            fullWidth
            isLoading={voting}
            onPress={handleRankedVote}
            isDisabled={rankedOrdered.length === 0}
            className="mt-4"
          >
            Submit Ranking
          </Button>
        ) : (
          <p className="text-sm text-success text-center mt-2">Ranking submitted!</p>
        )}
        <ImageModal isOpen={isImageOpen} onClose={onImageClose} src={previewImage} />
      </div>
    );
  }

  // --- Render: Vote to Points (Rating) ---
  if (poll?.poll_type === 'vote_to_points') {
    return (
      <div className="space-y-4">
        {showQuestion && <p className="text-base font-semibold">{poll?.question}</p>}
        <p className="text-sm text-default-500">Rate each option (0-10)</p>

        <div className="space-y-4">
          {options.map((opt) => (
            <div key={opt.id} className="space-y-2 p-3 bg-content2 rounded-lg">
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                    {opt.image_url && (
                        <div className="shrink-0 cursor-pointer" onClick={() => openImage(opt.image_url)}>
                            <img src={opt.image_url} alt="Option" className="w-10 h-10 object-cover rounded-md border border-default-200" />
                        </div>
                    )}
                    <label className="font-medium">{opt.label}</label>
                </div>
                <span className="text-lg font-bold text-primary">
                  {pointsMap[opt.id] || 0}
                </span>
              </div>
              <Slider
                size="md"
                step={1}
                maxValue={10}
                minValue={0}
                value={pointsMap[opt.id] || 0}
                onChange={(val) =>
                  setPointsMap((prev) => ({ ...prev, [opt.id]: val }))
                }
                className="max-w-full"
                aria-label={`Rate ${opt.label}`}
                isDisabled={hasVoted}
              />
            </div>
          ))}
        </div>

        {!hasVoted ? (
          <Button
            color="primary"
            fullWidth
            isLoading={voting}
            onPress={handlePointsVote}
            className="mt-4"
          >
            Submit Ratings
          </Button>
        ) : (
          <p className="text-sm text-success text-center mt-2">Ratings submitted!</p>
        )}
        <ImageModal isOpen={isImageOpen} onClose={onImageClose} src={previewImage} />
      </div>
    );
  }


  // --- Render: Simple ---
  return (
    <div className="space-y-4">
      {showQuestion && <p className="text-base font-semibold">{poll?.question}</p>}
      <div className="space-y-2">
        {options.map((opt) => {
          const isSelected = selectedOptionId === opt.id;
          return (
            <motion.div
              key={opt.id}
              whileHover={!hasVoted ? { scale: 1.01 } : {}}
              whileTap={!hasVoted ? { scale: 0.99 } : {}}
              onClick={() => !hasVoted && setSelectedOptionId(opt.id)}
              className={`
                cursor-pointer p-4 rounded-lg border-2 flex items-center gap-3 transition-colors
                ${isSelected 
                  ? 'border-primary bg-primary/5' 
                  : 'border-default-200 bg-content1 hover:border-primary/50'}
              `}
            >
              <div className={`
                w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
                ${isSelected ? 'border-primary' : 'border-default-400'}
              `}>
                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </div>
              {opt.image_url && (
                <div className="shrink-0" onClick={(e) => { e.stopPropagation(); openImage(opt.image_url); }}>
                   <div className="w-12 h-12 rounded-md border border-default-200 overflow-hidden bg-default-100">
                      <Image 
                        src={opt.image_url} 
                        alt="Option" 
                        classNames={{ wrapper: "w-full h-full", img: "w-full h-full object-cover" }}
                        radius="none"
                      />
                   </div>
                </div>
              )}
              <span className={`flex-1 font-medium ${isSelected ? 'text-primary' : ''}`}>
                {opt.label}
              </span>
            </motion.div>
          );
        })}
      </div>
      {!hasVoted && (
        <Button
          color="primary"
          fullWidth
          isLoading={voting}
          onPress={handleSimpleVote}
        >
          Vote
        </Button>
      )}
      {hasVoted && <p className="text-sm text-success">Your vote is recorded</p>}
      <ImageModal isOpen={isImageOpen} onClose={onImageClose} src={previewImage} />
    </div>
  );
}

function ImageModal({ isOpen, onClose, src }) {
  if (!src) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" backdrop="blur">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalBody className="p-0 overflow-hidden flex justify-center items-center bg-black/5 relative min-h-[50vh]">
              <Button isIconOnly variant="light" className="absolute top-2 right-2 z-50 bg-black/20 text-white" onPress={onClose}>
                <X size={20} />
              </Button>
              <Image
                src={src}
                alt="Preview"
                className="max-w-full max-h-[80vh] object-contain"
                radius="none"
              />
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
