# Agent Instructions for departs-app

You are a senior software engineer working on the `departs-app`, a real-time public transport tracking application.

## Core Architecture Principles

1. **State vs. Derived Data**:
    - The `useMapReducer` should store **minimal identifiers** (e.g., `selectedStopId`, `selectedTripId`).
    - Metadata and complex objects (e.g., `SelectedStop`, `VehicleDetail`) should be **derived on-the-fly** using hooks like `useSelectedStop` and `useSelectedVehicle`.
    - **Never** manually synchronize state in `useEffect` when it can be derived.

2. **Declarative Logic**:
    - Favor object spreading and functional transformations over manual field-by-field assignments and `if/else` chains.
    - Keep hooks "purely reactive" to state changes.

3. **Coding Standards**:
    - **Brackets**: Always use full curly brackets for all conditional blocks like `if`, `else`, `for`, `while` (no one-liner `if` without `{}`).
    - **Arrow Functions**: For one-liner lambdas, do **not** use brackets or explicit `return` statements (e.g., `(x) => x + 1`). Only use `{}` and `return` for complex, multi-line logic.
    - **Type Safety**: Avoid `any`. Leverage existing interfaces in `src/types/transit.ts`.
    - **JSDoc**: Document every hook and complex utility explaining the "why" and its role in the system.

4. **UI Performance**:
    - The map runs at high frequency. Use direct MapLibre mutations (via `setPaintProperty`) for animations to bypass React re-renders.
    - Wrap map-layer components in `React.memo` and pass only primitive props to avoid expensive layer re-initialization.

5. **Semantic Split**:
    - **Store**: `useMapReducer` holds the minimal source of truth (IDs).
    - **Derived**: Hooks that resolve IDs into full objects (e.g., `useSelectedVehicle`).
    - **Interface**: `useMapInterface` manages side effects that bridge state to the physical map (URL, Camera, Animations).

## Specific Patterns

- **Vehicle Synchronization**: When merging vehicle data, the priority is: `API Detail (low frequency) > Live Map Stream (high frequency) > Reducer State`.
- **Static Fallback**: If real-time data is missing, the backend provides static GTFS data. In this mode, preserve any existing real-time position/delay if available.
- **Safe Area Insets**: Layouts must account for mobile notches and home indicators using `env(safe-area-inset-*)`.

## Repository Hygiene

- **No Utils Junk**: Avoid creating small utility files for logic that is only used within a single hook. Keep logic localized and declarative.
- **Pre-commit**: Always run `npm run build` to verify type safety before submitting.
- **Versioning**:
    - Increment the **patch** version (e.g., `0.21.0` -> `0.21.1`) for small bug fixes or minor refactors.
    - Increment the **minor** version (e.g., `0.21.0` -> `0.22.0`) for significant architectural changes or new features.
    - Always update the version in `package.json` before submitting.
