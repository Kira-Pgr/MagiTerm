# MagiTerm

MagiTerm is an AI-powered terminal simulator that allows you to execute commands, explore fictional systems, and interact with any hardware or software configuration you can dream up.

## Features

- **Invent Custom Systems**: Design impossible hardware configurations - a 10,000-core CPU, fictional OSes, or any system you can imagine
- **No Tedious Environment Installs**: A risk-free, cost-free environment to explore different operating systems and their commands
- **AI-Powered Command Execution**: Execute terminal commands in a simulated environment powered by GPT models
- **Command Explanations**: Get detailed explanations of command syntax and behavior
- **Smart Suggestions**: Generate command suggestions from natural language goals

## Tech Stack

### Core
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Beautiful UI components built on Radix UI

### Data & API
- **PostgreSQL** - Primary database (via Supabase)
- **Prisma** - Type-safe ORM
- **GraphQL Yoga** - GraphQL server
- **Relay** - Efficient GraphQL client

### AI & Processing
- **OpenAI Agents SDK** - Structured AI agent execution with GPT models
- **Shiki** - Syntax highlighting

### Authentication
- **Supabase** - Authentication and database hosting

## Prerequisites

- Node.js
- npm or yarn
- PostgreSQL database (Supabase recommended)
- OpenAI API key

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/RecollectIQ/MagiTerm.git
   cd MagiTerm
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```
   Note: `--legacy-peer-deps` is required due to Relay peer dependencies.

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and configure the following variables:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@host:5432/database"

   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

   # OpenAI
   OPENAI_API_KEY=your-openai-api-key

   # Agent Configuration (optional)
   AGENT_MODEL_EXECUTE=gpt-5.1
   AGENT_MODEL_EXPLAIN=gpt-5.1
   AGENT_MODEL_SUGGEST=gpt-5.1
   ```

4. **Set up the database**

   If using Supabase:
   - Create a new Supabase project
   - Navigate to the SQL Editor
   - Run the SQL from `db.sql`

   If using a local PostgreSQL:
   ```bash
   psql -U your_user -d your_database -f db.sql
   ```

5. **Generate Prisma client**
   ```bash
   npm run prisma:generate
   ```

## Development

Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## TODO

- [ ] Add streaming response for AI
- [ ] Add Email template
- [ ] Improve UI/UX