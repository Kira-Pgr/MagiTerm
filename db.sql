-- MagiTerm Database Schema for Supabase
-- This schema includes Row Level Security (RLS) policies to ensure users can only access their own data

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- User profiles
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE terminal_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    os TEXT NOT NULL DEFAULT 'ubuntu',
    title TEXT NOT NULL DEFAULT 'New Session',
    seed INTEGER NOT NULL DEFAULT 0,
    cpu TEXT NOT NULL DEFAULT 'Intel Xeon Silver',
    gpu TEXT NOT NULL DEFAULT 'NVIDIA RTX 4090',
    cwd TEXT NOT NULL DEFAULT '/',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Commands executed in sessions
CREATE TABLE commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES terminal_sessions(id) ON DELETE CASCADE,
    input TEXT NOT NULL,
    output TEXT,
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Terminal events for streaming/logging
CREATE TABLE terminal_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES terminal_sessions(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    data JSONB NOT NULL,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Optimize queries by user and creation time
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_terminal_sessions_user_created ON terminal_sessions(user_id, created_at DESC);
CREATE INDEX idx_terminal_sessions_user_id ON terminal_sessions(user_id);
CREATE INDEX idx_commands_session_id ON commands(session_id);
CREATE INDEX idx_terminal_events_session_ts ON terminal_events(session_id, ts DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp on user_profiles
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_terminal_sessions_updated_at
    BEFORE UPDATE ON terminal_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES - User Profiles
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON user_profiles
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
    ON user_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON user_profiles
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own profile
CREATE POLICY "Users can delete own profile"
    ON user_profiles
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES - Terminal Sessions
-- ============================================================================

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
    ON terminal_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own sessions
CREATE POLICY "Users can create own sessions"
    ON terminal_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update own sessions"
    ON terminal_sessions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete own sessions"
    ON terminal_sessions
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES - Commands
-- ============================================================================

-- Users can view commands from their own sessions
CREATE POLICY "Users can view own commands"
    ON commands
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM terminal_sessions
            WHERE terminal_sessions.id = commands.session_id
            AND terminal_sessions.user_id = auth.uid()
        )
    );

-- Users can insert commands into their own sessions
CREATE POLICY "Users can insert own commands"
    ON commands
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM terminal_sessions
            WHERE terminal_sessions.id = commands.session_id
            AND terminal_sessions.user_id = auth.uid()
        )
    );

-- Users can update commands in their own sessions
CREATE POLICY "Users can update own commands"
    ON commands
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM terminal_sessions
            WHERE terminal_sessions.id = commands.session_id
            AND terminal_sessions.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM terminal_sessions
            WHERE terminal_sessions.id = commands.session_id
            AND terminal_sessions.user_id = auth.uid()
        )
    );

-- Users can delete commands from their own sessions
CREATE POLICY "Users can delete own commands"
    ON commands
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM terminal_sessions
            WHERE terminal_sessions.id = commands.session_id
            AND terminal_sessions.user_id = auth.uid()
        )
    );

-- ============================================================================
-- RLS POLICIES - Terminal Events
-- ============================================================================

-- Users can view events from their own sessions
CREATE POLICY "Users can view own terminal events"
    ON terminal_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM terminal_sessions
            WHERE terminal_sessions.id = terminal_events.session_id
            AND terminal_sessions.user_id = auth.uid()
        )
    );

-- Users can insert events into their own sessions
CREATE POLICY "Users can insert own terminal events"
    ON terminal_events
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM terminal_sessions
            WHERE terminal_sessions.id = terminal_events.session_id
            AND terminal_sessions.user_id = auth.uid()
        )
    );

-- Users can update events in their own sessions
CREATE POLICY "Users can update own terminal events"
    ON terminal_events
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM terminal_sessions
            WHERE terminal_sessions.id = terminal_events.session_id
            AND terminal_sessions.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM terminal_sessions
            WHERE terminal_sessions.id = terminal_events.session_id
            AND terminal_sessions.user_id = auth.uid()
        )
    );

-- Users can delete events from their own sessions
CREATE POLICY "Users can delete own terminal events"
    ON terminal_events
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM terminal_sessions
            WHERE terminal_sessions.id = terminal_events.session_id
            AND terminal_sessions.user_id = auth.uid()
        )
    );

-- ============================================================================
-- HELPER FUNCTIONS (Optional)
-- ============================================================================

-- Function to create a user profile automatically when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_profiles IS 'User profile information linked to auth.users';
COMMENT ON TABLE terminal_sessions IS 'Terminal sessions with OS, CPU, GPU configuration';
COMMENT ON TABLE commands IS 'Commands executed in terminal sessions with metrics';
COMMENT ON TABLE terminal_events IS 'Event stream for terminal output and status updates';

COMMENT ON COLUMN terminal_sessions.seed IS 'Random seed for reproducible AI responses';
COMMENT ON COLUMN commands.tokens_in IS 'Number of input tokens processed';
COMMENT ON COLUMN commands.tokens_out IS 'Number of output tokens generated';
COMMENT ON COLUMN commands.latency_ms IS 'Command execution latency in milliseconds';
COMMENT ON COLUMN terminal_events.kind IS 'Event type: token, stderr, status, etc.';
COMMENT ON COLUMN terminal_events.data IS 'Event payload as JSON';
