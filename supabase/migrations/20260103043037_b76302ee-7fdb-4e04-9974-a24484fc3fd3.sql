-- Free Agent Sessions table for persistent memory across sessions
CREATE TABLE public.free_agent_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_name TEXT,
  status TEXT NOT NULL DEFAULT 'idle',
  prompt TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  max_iterations INTEGER NOT NULL DEFAULT 50,
  current_iteration INTEGER NOT NULL DEFAULT 0,
  final_report JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Blackboard entries for agent memory
CREATE TABLE public.free_agent_blackboard (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.free_agent_sessions(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('observation', 'insight', 'question', 'decision', 'plan', 'artifact', 'error')),
  content TEXT NOT NULL,
  data JSONB,
  iteration INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tool calls tracking
CREATE TABLE public.free_agent_tool_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.free_agent_sessions(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'completed', 'error')),
  result JSONB,
  error TEXT,
  iteration INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Artifacts created by agent
CREATE TABLE public.free_agent_artifacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.free_agent_sessions(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('text', 'file', 'image', 'data')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  description TEXT,
  mime_type TEXT,
  size INTEGER,
  iteration INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Session files uploaded by user
CREATE TABLE public.free_agent_session_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.free_agent_sessions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  content TEXT, -- base64 for binary, plain text for text files
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Messages for conversation history
CREATE TABLE public.free_agent_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.free_agent_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  artifacts JSONB,
  iteration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_blackboard_session ON public.free_agent_blackboard(session_id);
CREATE INDEX idx_blackboard_category ON public.free_agent_blackboard(category);
CREATE INDEX idx_tool_calls_session ON public.free_agent_tool_calls(session_id);
CREATE INDEX idx_artifacts_session ON public.free_agent_artifacts(session_id);
CREATE INDEX idx_messages_session ON public.free_agent_messages(session_id);
CREATE INDEX idx_session_files_session ON public.free_agent_session_files(session_id);

-- Enable RLS (public access for now since no auth)
ALTER TABLE public.free_agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_agent_blackboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_agent_tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_agent_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_agent_session_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_agent_messages ENABLE ROW LEVEL SECURITY;

-- Allow public access (no auth required for this app)
CREATE POLICY "Allow all access to sessions" ON public.free_agent_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to blackboard" ON public.free_agent_blackboard FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to tool_calls" ON public.free_agent_tool_calls FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to artifacts" ON public.free_agent_artifacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to session_files" ON public.free_agent_session_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to messages" ON public.free_agent_messages FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updating session updated_at
CREATE OR REPLACE FUNCTION public.update_free_agent_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_free_agent_sessions_updated_at
  BEFORE UPDATE ON public.free_agent_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_free_agent_session_timestamp();

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.free_agent_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.free_agent_blackboard;
ALTER PUBLICATION supabase_realtime ADD TABLE public.free_agent_tool_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.free_agent_artifacts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.free_agent_messages;