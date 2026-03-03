# 🤝 Contributing to Capture Hub

Thank you for your interest in contributing to Capture Hub! This guide will help you understand how to contribute effectively.

## 📋 Table of Contents

- [Code Style Guidelines](#code-style-guidelines)
- [Commit Message Conventions](#commit-message-conventions)
- [Development Setup](#development-setup)
- [Feature Creation Process](#feature-creation-process)
- [Testing Requirements](#testing-requirements)
- [Pull Request Review Process](#pull-request-review-process)
- [Questions or Issues?](#questions-or-issues)

---

## 🎨 Code Style Guidelines

### TypeScript & JavaScript

Capture Hub uses TypeScript 5 with the following conventions:

#### File Organization

```
src/
├── app/              # Next.js App Router pages and API routes
├── components/       # React components organized by feature
│   ├── ui/          # shadcn/ui base components
│   └── [Feature]/   # Feature-specific components
├── contexts/        # React context providers
├── hooks/          # Custom React hooks
├── lib/            # Utility functions and helpers
└── test/           # Test files and fixtures
```

#### Component Structure

```tsx
'use client'; // Add for client components

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { type SomeInterface } from '@/lib/types';

interface ComponentProps {
  // Prop definitions with TypeScript types
  title: string;
  onAction?: () => void;
}

export function ComponentName({
  title,
  onAction,
}: ComponentProps) {
  // Hooks at the top
  const [state, setState] = useState<string>('');

  // Event handlers
  const handleClick = () => {
    // Handler logic
  };

  // Effects
  useEffect(() => {
    // Effect logic
  }, []);

  return (
    <div className="container">
      {/* JSX */}
    </div>
  );
}
```

#### Naming Conventions

- **Components**: PascalCase (`Header.tsx`, `QuickCapture.tsx`)
- **Utilities**: camelCase (`formatDate.ts`, `cn.ts`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_ITEMS`, `DEFAULT_TIMEOUT`)
- **Interfaces/Types**: PascalCase with `I` prefix discouraged (`CaptureItem`, `UserData`)

#### Import Order

```tsx
// 1. React and Next.js imports
import { useState } from 'react';
import Link from 'next/link';

// 2. Third-party library imports
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

// 3. Local component imports
import { Header } from '@/components/Header/Header';

// 4. Utility imports
import { cn } from '@/lib/utils';

// 5. Type imports
import type { CaptureItem } from '@/lib/types';
```

### CSS & Tailwind

- Use Tailwind utility classes for all styling
- Follow mobile-first responsive design (`md:`, `lg:`, `xl:`)
- Use `cn()` utility for conditional classes
- Apply semantic color tokens (`bg-background`, `text-muted-foreground`)

```tsx
import { cn } from '@/lib/utils';

<div className={cn(
  "base-classes",
  condition && "conditional-classes",
  className
)}>
```

### TypeScript Configuration

- `strict: true` enabled
- Path alias `@/*` maps to `./src/*`
- Target: ES2017 with esnext lib

### ESLint Rules

Project uses `eslint-config-next` with custom overrides:
- `@typescript-eslint/no-explicit-any: off`
- `react-hooks/exhaustive-deps: off`
- `no-console: off`

Run linter before committing:
```bash
bun run lint
```

---

## 📝 Commit Message Conventions

We follow semantic commit messages to maintain a clear project history.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semi-colons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### Examples

```bash
# Simple feature
git commit -m "feat: add dark mode toggle"

# Feature with scope
git commit -m "feat(header): add device indicator component"

# Bug fix
git commit -m "fix: resolve WebSocket reconnection issue"

# Complex change with body
git commit -m "feat(capture): implement bulk delete functionality" \
  "- Add checkbox selection to inbox items" \
  "- Add bulk delete button in header" \
  "- Add confirmation dialog for bulk actions" \
  "- Update API endpoint to support bulk operations"

# Breaking change (rare)
git commit -m "feat!: remove legacy export endpoint

BREAKING CHANGE: The /api/export/legacy endpoint has been removed.
Use /api/export instead."
```

### Good Practices

- Use imperative mood ("add" not "added" or "adds")
- Limit first line to 72 characters
- Skip period at end of subject
- Reference issues in body: `Closes #123`
- Co-author commits when working with AI: `Co-Authored-By: Claude <noreply@anthropic.com>`

---

## 🛠️ Development Setup

### Prerequisites

Before starting development, ensure you have:

1. **Bun** - JavaScript runtime and package manager
   ```bash
   # Install Bun (if not already installed)
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Node.js 20+** - Required for Next.js compatibility

3. **z-ai-web-dev-sdk API Key** (Optional)
   - AI features gracefully degrade without it
   - Get your key at [z.ai](https://z.ai/)

### Initial Setup

```bash
# 1. Clone your fork
git clone https://github.com/your-username/capture-hub-project.git
cd capture-hub-project

# 2. Install dependencies
bun install

# 3. Copy environment file
cp .env.example .env

# 4. Edit .env with your configuration
# Minimum required:
# DATABASE_URL=file:./prisma/dev.db

# 5. Initialize database
bun run db:generate  # Generate Prisma client
bun run db:push      # Push schema to database

# 6. Start development server
bun run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

### Development Workflow

```bash
# Start development server (with WebSocket)
bun run dev

# Start on alternative port (useful for multi-device testing)
bun run dev:3001

# Run linter
bun run lint

# Run tests
bun run test

# Run tests with UI
bun run test:ui

# Database operations
bun run db:push      # Push schema changes
bun run db:generate  # Regenerate Prisma client
bun run db:reset     # Reset database (WARNING: deletes data)

# Build for production
bun run build

# Start production server
bun start
```

### Environment Variables

Create a `.env` file in the project root:

```bash
# Required
DATABASE_URL=file:./prisma/dev.db

# Optional
PORT=3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
ZAI_API_KEY=your-api-key-here
OPENAI_API_KEY=your-openai-key-here
```

---

## 🚀 Feature Creation Process

### 1. Understand the Requirements

Before starting development:

- Read the feature specification in `app_spec.txt`
- Check for related features or dependencies
- Review existing code patterns in similar components

### 2. Create a Feature Branch

```bash
# From main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/your-bug-name
```

Branch naming conventions:
- `feature/feature-name` - New features
- `fix/bug-name` - Bug fixes
- `docs/update-name` - Documentation updates
- `refactor/component-name` - Code refactoring

### 3. Implementation Steps

#### Frontend Components

1. **Create the component file**
   ```bash
   # Example: Creating a new feature component
   mkdir -p src/components/YourFeature
   touch src/components/YourFeature/YourComponent.tsx
   ```

2. **Follow the component template**
   ```tsx
   'use client';

   import { useState } from 'react';
   import { Button } from '@/components/ui/button';
   import type { YourProps } from '@/lib/types';

   interface YourComponentProps {
     // Define props
   }

   export function YourComponent({ }: YourComponentProps) {
     const [state, setState] = useState();

     return (
       <div>
         {/* Component JSX */}
       </div>
     );
   }
   ```

3. **Add TypeScript types** (if needed)
   ```typescript
   // src/lib/types.ts
   export interface YourDataType {
     id: string;
     name: string;
     createdAt: Date;
   }
   ```

4. **Integrate with the app**
   - Import in parent component or page
   - Add routing if needed
   - Connect to WebSocket for real-time updates

#### Backend/API Routes

1. **Create API route**
   ```bash
   # Example: Creating a new endpoint
   mkdir -p src/app/api/your-endpoint
   touch src/app/api/your-endpoint/route.ts
   ```

2. **Implement the route**
   ```typescript
   import { NextRequest, NextResponse } from 'next/server';
   import { prisma } from '@/lib/db';

   export async function GET(request: NextRequest) {
     try {
       // Your logic here
       return NextResponse.json({ data: [] });
     } catch (error) {
       return NextResponse.json(
         { error: 'Internal server error' },
         { status: 500 }
       );
     }
   }

   export async function POST(request: NextRequest) {
     // Handle POST
   }
   ```

3. **Broadcast updates via WebSocket**
   ```typescript
   import { broadcastToAll } from '@/lib/websocket-server';

   // After data mutation
   broadcastToAll({
     type: 'item:created',
     data: newItem,
   });
   ```

### 4. Testing Your Changes

```bash
# Run linter
bun run lint

# Fix linting errors automatically (if possible)
bun run lint --fix

# Run unit tests
bun run test:run

# Run integration tests
bun run test:run

# Check TypeScript compilation
bun run build
```

### 5. Local Verification

Before committing, verify:

- ✅ Linter passes with no errors
- ✅ TypeScript compiles successfully
- ✅ All tests pass
- ✅ Feature works end-to-end in browser
- ✅ No console errors
- ✅ Responsive design works on mobile
- ✅ WebSocket real-time sync works (if applicable)

---

## 🧪 Testing Requirements

### Test Structure

```
src/
├── lib/
│   ├── utils.ts
│   └── utils.test.ts          # Unit tests
├── components/
│   └── YourComponent/
│       ├── YourComponent.tsx
│       └── YourComponent.test.tsx  # Component tests
└── test/
    ├── fixtures.ts            # Test data
    ├── setup.ts              # Test configuration
    └── integration/
        ├── api.integration.test.ts
        └── websocket.integration.test.ts
```

### Writing Unit Tests

```typescript
// src/lib/utils.test.ts
import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('handles conditional classes', () => {
    expect(cn('base', true && 'active', false && 'inactive'))
      .toBe('base active');
  });
});
```

### Writing Component Tests

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    const { user } = setup(<Button onClick={handleClick}>Click</Button>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadTestFixtures, cleanTestFixtures } from '@/test/fixtures';

describe('Capture API', () => {
  beforeAll(async () => {
    await loadTestFixtures();
  });

  afterAll(async () => {
    await cleanTestFixtures();
  });

  it('creates a new capture item', async () => {
    const response = await fetch('/api/capture', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', content: 'Content' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.title).toBe('Test');
  });
});
```

### Test Commands

```bash
# Run all tests
bun run test

# Run tests in watch mode
bun run test:watch

# Run tests once
bun run test:run

# Run tests with UI
bun run test:ui

# Generate coverage report
bun run test:coverage

# Run specific test file
bun run test src/lib/utils.test.ts
```

### Coverage Requirements

- Aim for >80% code coverage
- All critical paths must be tested
- New features must include tests
- Bug fixes must include regression tests

---

## 🔍 Pull Request Review Process

### Before Submitting

1. **Update your branch**
   ```bash
   git checkout main
   git pull upstream main
   git checkout feature/your-feature
   git rebase main
   ```

2. **Run full test suite**
   ```bash
   bun run lint
   bun run test:run
   bun run build
   ```

3. **Clean up commit history**
   ```bash
   # Squash related commits if needed
   git rebase -i HEAD~n
   ```

### Submitting Your PR

1. **Push to your fork**
   ```bash
   git push origin feature/your-feature
   ```

2. **Create Pull Request** on GitHub

3. **Fill out the PR template**

### PR Description Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issue
Closes #123

## Changes Made
- Added X feature
- Fixed Y bug
- Updated Z component

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manually tested in browser
- [ ] Tested on mobile (if applicable)

## Screenshots (if applicable)
[Add screenshots for UI changes]

## Checklist
- [ ] Code follows style guidelines
- [ ] Linter passes
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No merge conflicts
```

### Review Process

1. **Automated Checks**
   - CI/CD pipeline runs linter and tests
   - All checks must pass before merge

2. **Code Review**
   - Maintainers review your code
   - Address requested changes
   - Respond to comments promptly

3. **Approval & Merge**
   - At least one maintainer approval required
   - Squash and merge to main
   - Delete feature branch after merge

### What We Look For

- ✅ Follows code style guidelines
- ✅ Clear, readable code
- ✅ Proper error handling
- ✅ Tests included and passing
- ✅ Documentation updated
- ✅ No breaking changes (or clearly documented)
- ✅ Performance considerations addressed
- ✅ Accessibility (a11y) maintained
- ✅ Responsive design works

---

## 🙋 Questions or Issues?

### Getting Help

1. **Check existing documentation**
   - [README.md](README.md) - Project overview
   - [app_spec.txt](app_spec.txt) - Feature specifications

2. **Search existing issues**
   - Check [GitHub Issues](../../issues)
   - Someone may have asked already

3. **Create a new issue**
   - Use appropriate issue templates
   - Provide reproduction steps for bugs
   - Include screenshots when applicable

4. **Join discussions**
   - Ask questions in GitHub Discussions
   - Be respectful and constructive

### Issue Templates

#### Bug Report
```markdown
## Description
Clear description of the bug

## Steps to Reproduce
1. Go to...
2. Click on...
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [e.g. Windows 11]
- Browser: [e.g. Chrome 120]
- Node version: [e.g. 20.10.0]
- Bun version: [e.g. 1.0.0]

## Screenshots
[If applicable]

## Additional Context
[Logs, error messages, etc.]
```

#### Feature Request
```markdown
## Problem Statement
What problem does this solve?

## Proposed Solution
How should it work?

## Alternatives Considered
What other approaches did you consider?

## Additional Context
Mockups, examples, etc.
```

---

## 📜 Code of Conduct

### Our Pledge

In the interest of fostering an open and welcoming environment, we pledge to make participation in our project and our community a harassment-free experience for everyone.

### Our Standards

Examples of behavior that contributes to a positive environment:
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

### Unacceptable Behavior

Examples of unacceptable behavior:
- Harassment, trolling, or derogatory comments
- Personal or political attacks
- Public or private harassment
- Publishing others' private information
- Unprofessional conduct

### Responsibilities

Project maintainers are responsible for clarifying standards of acceptable behavior and will take appropriate and fair corrective action in response to any instances of unacceptable behavior.

---

## 🎉 Thank You for Contributing!

Your contributions help make Capture Hub better for everyone. Whether it's a bug fix, new feature, documentation improvement, or just helping others in issues, we appreciate it!

**Happy Coding! 🚀**

---

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Vitest Documentation](https://vitest.dev)
- [shadcn/ui Components](https://ui.shadcn.com)
