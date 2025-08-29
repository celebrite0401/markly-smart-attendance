-- Enable the necessary extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job to automatically send absence notifications every 15 minutes
SELECT cron.schedule(
  'send-absence-notifications',
  '*/15 * * * *', -- every 15 minutes
  $$
  SELECT
    net.http_post(
        url:='https://hvtfbmhhpypzzevsladf.supabase.co/functions/v1/send-absence-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2dGZibWhocHlwenpldnNsYWRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTA3MzEsImV4cCI6MjA3MTk2NjczMX0.dxcwlHjlUiyAX9l--h90O1xLOczJSn2nEAK0HhDevYE"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);