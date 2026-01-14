# mcadence

A personal time & energy management tool built with Next.js, TypeScript, and Tailwind CSS.

## Features

### Three Main Tabs

1. **Day to Day** - Simple checklist for random tasks
2. **Hit My Goal** - Checklist for small challenges / high-satisfaction tasks  
3. **Spend My Time** - Time tracking of recurring projects (main feature)

### AI Features (manual, opt-in)
- **AI Insight**: On-demand, read-only summaries of your activity (time tracking + tasks) over a chosen period with highlights, patterns, friction points, and a short encouragement. Never modifies data.
- **Quick Add with AI**: Turns free-form text or pasted conversations into editable task/project proposals (intent, duration, recurrence, category inferred). You pick the tab, adjust, and approve; nothing is added automatically.
- **Suggested Removal (AI Clean-up)**: Proposes archive/delete for idle or low-progress items based on your usage and selected time range, with clear reasons. Changes apply only after explicit approval.

### Core Functionality

- ✅ Local storage persistence (no backend required)
- ✅ Mobile-first responsive design
- ✅ PWA-ready (manifest + service worker)
- ✅ Time tracking with weekly periods (Monday-Sunday, America/New_York)
- ✅ Visual alerts for progress (80% warning, overdue indicators)
- ✅ Action logging for all user activities
- ✅ CSV export/import for data backup/restore
- ✅ Archive/Delete functionality with confirmations
- ✅ Color-coded items with customizable categories

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data**: localStorage only
- **PWA**: Service worker + manifest
- **Target**: Vercel deployment

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── globals.css         # Global styles with Tailwind
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main page
├── components/
│   ├── layout/            # Layout components
│   │   ├── Header.tsx
│   │   └── Layout.tsx
│   ├── tabs/             # Tab components
│   │   ├── DayToDayTab.tsx
│   │   ├── HitMyGoalTab.tsx
│   │   └── SpendMyTimeTab.tsx
│   └── ui/               # Reusable UI components
│       ├── Button.tsx
│       ├── Modal.tsx
│       ├── ProgressBar.tsx
│       └── TabBar.tsx
├── lib/                   # Core logic
│   ├── constants.ts       # App constants
│   ├── csvUtils.ts        # CSV export/import
│   ├── state.ts          # React state management
│   ├── storage.ts        # localStorage utilities
│   └── types.ts         # TypeScript type definitions
└── utils/                 # Utility functions
    ├── date.ts           # Date/time utilities
    └── uuid.ts           # UUID generation
```

## Data Model

### Core Types

- **BaseItem**: Common fields for all items
- **ChecklistItem**: Day to Day / Hit My Goal items
- **TimeProject**: Spend My Time projects with tracking
- **ActionLog**: Activity logging for all operations

### Key Features

- **Weekly Periods**: Monday-Sunday tracking in America/New_York timezone
- **Progress Tracking**: Visual bars with % completion
- **Smart Alerts**: 80% warning + overdue indicators
- **Timer Management**: Only one active timer at a time
- **Data Export**: CSV format for items and actions
- **Data Import**: Combine or overwrite existing data

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

## Usage

### Day to Day / Hit My Goal
- Add tasks/goals with title, category, and color
- Check/uncheck to mark complete
- Archive to hide from main view
- Delete with confirmation

### Spend My Time
- Add projects with required time (weekly)
- Click project to start/stop timer
- Track progress through the week
- Automatic period reset on Monday
- Visual warnings for insufficient progress

### Data Management
- Export data as JSON or CSV files
- Import CSV with combine/overwrite options
- All data stored locally in localStorage

## PWA Features

- Installable on mobile devices
- Offline support with cached assets
- "Add to Home Screen" capability
- App shortcuts for quick actions

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers

## Future Enhancements

- [ ] Data synchronization across devices
- [ ] Advanced reporting and analytics
- [ ] AI-powered suggestions
- [ ] Collaboration features
- [ ] Webhook integrations
- [ ] Advanced time tracking features

## License

MIT
