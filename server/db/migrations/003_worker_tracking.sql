-- Add label_generated_by to track who printed the label
ALTER TABLE delivery_notes
  ADD COLUMN IF NOT EXISTS label_generated_by UUID REFERENCES workers(id);
