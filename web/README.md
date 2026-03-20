# EVY Web

A React-based app builder built with Bun.

Shared types (`SDUI_Flow`, `SDUI_Page`, `SDUI_Row`, RPC payloads) come from the schema-generated `evy-types` package (see `tsconfig.json` path alias to `../types/generated/ts`). After changing schemas in `types/schema/`, run `bun run types:generate` from the repo root and commit the updated generated files.

## Architecture

```mermaid
%%{init: {'theme': 'default', 'flowchart': {'rankSpacing': 60, 'nodeSpacing': 30}}}%%
graph TD
    subgraph app [App Layer]
        App[App.tsx]
        NavBar[NavBar]
        AppContent[AppContent]
    end

    subgraph state [State Management]
        AppProvider[AppProvider]
        FlowsContext[FlowsContext]
        DragContext[DragContext]
        PageReducer[pageReducer]
        DraggingReducer[draggingReducer]
        DropIndicatorReducer[dropIndicatorReducer]
    end

    subgraph nav [Navigation]
        NavigationBreadcrumb[NavigationBreadcrumb]
        PopoverSelect[PopoverSelect]
        CreateFlowDialog[CreateFlowDialog]
    end

    subgraph layout [Layout Panels]
        RowsPanel[RowsPanel]
        SearchInput[SearchInput]
        CancelOverlay[CancelOverlay]
        CanvasViewport[CanvasViewport]
        CanvasPageFrame[CanvasPageFrame]
        ConfigPanel[ConfigurationPanel]

        subgraph pages [Page Content]
            AppPage[AppPage]
            SecondarySheetPage[SecondarySheetPage]
            ActionEditor[ActionEditor]
            ActionPopup[ActionPopup]
        end
    end

    subgraph hooks [Hooks]
        useCamera[useCamera]
        usePageDropTarget[usePageDropTarget]
        useDraggable[useDraggable]
        useFlows[useFlows]
        useRowById[useRowById]
        useUrlSync[useUrlSync]
    end

    subgraph dragdrop [Drag and Drop]
        DraggableRowContainer[DraggableRowContainer]
        ContainerChildren[ContainerChildren]
        RowPrimitive[RowPrimitive]
        PlaceholderDropIndicator[PlaceholderDropIndicator]
        DropHandler[handleDrop]
    end

    subgraph rows [Row Components]
        defineRow["defineRow() factory"]
        ViewRows[View Rows]
        EditRows[Edit Rows]
        ActionRows[Action Rows]
        ContainerRows[Container Rows]
    end

    subgraph designsystem [Design System]
        RowLayout[RowLayout]
        Button[Button]
        Input[Input]
        TextAreaDS[TextArea]
        Dropdown[Dropdown]
        RadioButton[RadioButton]
        Checkbox[Checkbox]
        EVYText[EVYText]
        InlineIcon[InlineIcon]
        DropIndicator[dropIndicator]
    end

    App --> AppProvider
    AppProvider --> FlowsContext
    AppProvider --> DragContext
    FlowsContext --> PageReducer
    DragContext --> DraggingReducer
    DragContext --> DropIndicatorReducer

    App --> NavBar
    NavBar --> NavigationBreadcrumb
    NavigationBreadcrumb --> PopoverSelect
    NavigationBreadcrumb --> CreateFlowDialog

    App --> AppContent
    AppContent --> RowsPanel
    AppContent --> CanvasViewport
    AppContent --> ConfigPanel
    AppContent --> DropHandler

    RowsPanel --> SearchInput
    RowsPanel --> CancelOverlay
    RowsPanel --> DraggableRowContainer

    CanvasViewport --> useCamera
    CanvasViewport --> CanvasPageFrame
    CanvasPageFrame --> AppPage
    CanvasPageFrame --> SecondarySheetPage

    AppPage --> usePageDropTarget
    AppPage --> DraggableRowContainer
    SecondarySheetPage --> usePageDropTarget
    SecondarySheetPage --> DraggableRowContainer

    ConfigPanel --> ActionEditor
    ActionEditor --> ActionPopup

    DraggableRowContainer --> useDraggable
    DraggableRowContainer --> RowPrimitive
    DraggableRowContainer --> ContainerChildren
    ContainerChildren --> PlaceholderDropIndicator

    DraggableRowContainer --> defineRow
    defineRow --> ViewRows
    defineRow --> EditRows
    defineRow --> ActionRows
    defineRow --> ContainerRows

    RowPrimitive --> DropIndicator
    EditRows --> designsystem
    ActionRows --> designsystem
```

### Key Components

| Component              | Description                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| **App**                | Main entry point, sets up layout with header and three-panel design |
| **NavBar**             | Top bar with logo and breadcrumb navigation                         |
| **NavigationBreadcrumb** | Flow/page/row breadcrumb with flow selector and focus mode toggle |
| **AppProvider**        | React context provider managing flows, rows, drag state, focus mode, and config stack |
| **RowsPanel**          | Left sidebar displaying available row components with search        |
| **AppPage**            | Center panel showing phone preview with draggable rows              |
| **SecondarySheetPage** | Secondary phone preview for sheet content in focus mode             |
| **ConfigurationPanel** | Right sidebar for editing row properties, page titles, and actions  |
| **ActionEditor**       | Action configuration UI within the configuration panel              |
| **useDraggable**       | Custom hook encapsulating drag-and-drop behavior                    |
| **usePageDropTarget**  | Hook setting up page-level drop targets for drag-and-drop           |
| **defineRow**          | Factory function used to declare all row components                 |

### Row Categories

- **View Rows**: Display-only components (TextRow, InfoRow, InputListRow)
- **Edit Rows**: Form input components (InputRow, DropdownRow, CalendarRow, TextAreaRow, SearchRow, SelectPhotoRow, InlinePickerRow, TextSelectRow)
- **Action Rows**: Interactive components (ButtonRow, TextActionRow)
- **Container Rows**: Layout components that hold child rows (ListContainerRow, ColumnContainerRow, SheetContainerRow, SelectSegmentContainerRow)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed on your system

### Installation

```bash
bun install
```

Create a root `.env` file at the repository root (`../.env` from the `web` directory). The web scripts load environment variables from this shared root env file.

### Running the App

#### Development Mode

```bash
bun run dev
```

This will build the application and start the dev server with hot reloading.

#### Production Mode

```bash
bun run build
bun run start
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Docker

#### Build and Run

```bash
docker build -t evy-web .
docker run -p 3000:3000 evy-web
```

#### Using Docker Compose

From the repo root (the web app has no `docker-compose.yml` in its directory):

```bash
docker compose up -d
```

You can configure the port via the `WEB_PORT` environment variable (default: 3000).

## Testing

This project uses Playwright for both component tests and end-to-end tests.

### Setup (local only)

Install Chromium and its system dependencies (not needed in CI -- the CI image has them pre-installed):

```bash
bun run test:setup
```

### Running Tests

Component and integration tests (`tests/`):

```bash
bun run test
```

End-to-end tests (`e2e/`) -- requires the full stack to be running (see [root README](../README.md#e2e-tests)):

```bash
bun run test:e2e
```

To run the component tests with UI or debug mode:

```bash
bun run test --ui
bun run test --debug
```

## License

Licensed under GPL-3.0-only; see [LICENSE](LICENSE) and the repository root [LICENSE](../LICENSE).
