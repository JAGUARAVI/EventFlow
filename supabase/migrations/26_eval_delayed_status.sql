-- Add 'delayed' as a valid slot status
ALTER TABLE eval_slots DROP CONSTRAINT IF EXISTS eval_slots_status_check;
ALTER TABLE eval_slots ADD CONSTRAINT eval_slots_status_check 
  CHECK (status IN ('scheduled', 'live', 'completed', 'rescheduled', 'no_show', 'cancelled', 'delayed'));

-- Add column to track which slot the delay starts from
ALTER TABLE eval_panels ADD COLUMN IF NOT EXISTS delay_from_slot_id UUID REFERENCES eval_slots(id) ON DELETE SET NULL;

-- Add index for the delay_from_slot_id
CREATE INDEX IF NOT EXISTS idx_eval_panels_delay_from_slot ON eval_panels(delay_from_slot_id) WHERE delay_from_slot_id IS NOT NULL;
