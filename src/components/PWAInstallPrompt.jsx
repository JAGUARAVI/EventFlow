import { useState, useEffect } from 'react';
import { Button } from '@heroui/react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    // Optionally, send analytics event with outcome of user choice
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsVisible(false);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
           initial={{ y: 100, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           exit={{ y: 100, opacity: 0 }}
           className="fixed bottom-6 left-6 right-6 z-50 md:left-auto md:right-6 md:w-80"
        >
          <div className="bg-default-100/90 backdrop-blur-md border border-default-200 p-4 rounded-xl shadow-xl flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="font-bold text-small">Install EventFlow</span>
              <span className="text-tiny text-default-500">Add to home screen for quick access</span>
            </div>
            <div className="flex gap-2 items-center">
              <Button size="sm" isIconOnly variant="light" onPress={() => setIsVisible(false)} className="text-default-400">
                <X size={18} />
              </Button>
              <Button size="sm" color="primary" onPress={handleInstall} startContent={<Download size={16} />} className="font-semibold">
                Install
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
