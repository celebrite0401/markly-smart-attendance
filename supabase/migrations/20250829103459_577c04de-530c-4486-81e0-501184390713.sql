-- Enable RLS on the postgres_logs table  
ALTER TABLE public.postgres_logs ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow system functions to write logs
CREATE POLICY "System can manage logs" 
ON public.postgres_logs 
FOR ALL 
USING (true);