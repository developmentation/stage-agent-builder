-- Drop all free_agent tables
DROP TABLE IF EXISTS public.free_agent_session_files CASCADE;
DROP TABLE IF EXISTS public.free_agent_messages CASCADE;
DROP TABLE IF EXISTS public.free_agent_tool_calls CASCADE;
DROP TABLE IF EXISTS public.free_agent_artifacts CASCADE;
DROP TABLE IF EXISTS public.free_agent_blackboard CASCADE;
DROP TABLE IF EXISTS public.free_agent_sessions CASCADE;

-- Drop the trigger function if it exists
DROP FUNCTION IF EXISTS public.update_free_agent_session_timestamp() CASCADE;