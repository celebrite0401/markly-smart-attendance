-- Add a field to track if notifications have been sent for each session
ALTER TABLE sessions ADD COLUMN notifications_sent BOOLEAN DEFAULT false;