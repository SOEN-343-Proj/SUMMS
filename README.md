# CityFlow
Smart Urban Mobility Management System

## How to run
**Prior to executing the steps, install React & Node on your device**

1. Clone the repository --> `git clone https://github.com/SOEN-343-Proj/SUMMS.git`
2. On the project folder, open one terminal (for backend) --> `uvicorn src.backend.main:app --reload`
3. Open new terminal (for frontend) run --> `npm install` and then on same terminal run --> `npm run dev`
5. Hover on the localhost link & Ctrl + Click on it

## Architecture
The project now follows an MVC-style split on both the frontend and backend.

### Frontend
- `src/components/` contains the view layer.
- `src/controllers/` contains controller hooks that manage UI state and user interactions.
- `src/models/` contains API clients, shared data helpers, and external data adapters.

### Backend
- `src/backend/routes/` contains the HTTP route layer.
- `src/backend/controllers/` contains request orchestration and API-facing control flow.
- `src/backend/models/` contains domain/data access modules and wraps the existing mobility logic.

### Runtime Notes
- The user-facing behavior and API surface are preserved.
- Existing rental/payment domain logic from `src/backend/Sprint1Implementation/` is now consumed through the MVC backend layer.

## Team Architects Members
- Antonino Guarraci - 40264079
- Benedetto Guidi - 40228072
- Justin Lombardi - 40263452
- Malcolm Arcand-Laliberté - 26334792
- Vladimir Todorov - 40203170
