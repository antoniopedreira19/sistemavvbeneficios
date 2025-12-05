-- Enable REPLICA IDENTITY FULL for lotes_mensais to support realtime
ALTER TABLE public.lotes_mensais REPLICA IDENTITY FULL;

-- Add lotes_mensais to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.lotes_mensais;