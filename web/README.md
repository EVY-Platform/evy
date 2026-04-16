# EVY Web

A React-based app builder.

Shared types (`UI_Flow`, `UI_Page`, `UI_Row`, `DATA_EVY_*` rows, RPC payloads) come from the schema-generated `evy-types` package (see `tsconfig.json` path alias to `../types/generated/ts`).

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

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed on your system
- PostgreSQL database (or use Docker Compose)

### Environment Variables

Ensure your root env file (`../.env`) is set with the .env.example. The following environment variables are used by the Web:

```env
WEB_PORT=3000
API_URL=http://localhost:8000
```

### Running dev app with hot-reload

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Docker

```bash
docker build -t evy-web .
docker run -p 3000:3000 evy-web
```

### Docker Compose

From the repo root (the web app has no `docker-compose.yml` in its directory):

```bash
docker compose up -d web
```

You can configure the port via the `WEB_PORT` environment variable (default: 3000).

## Testing

This project uses Playwright for both component tests and end-to-end tests.

Install Chromium and its system dependencies (not needed in CI -- the CI image has them pre-installed):

```bash
bun run test:setup
```

To run the component tests with UI or debug mode:

```bash
bun run test --ui
bun run test --debug
```

## Available Scripts

| Script                 | Description                              |
| ---------------------- | ---------------------------------------- |
| `bun run dev`          | Start the web app in development mode    |
| `bun run build`        | Build the production assets into `dist/` |
| `bun run start`        | Start the web app using the Bun server   |
| `bun run lint`         | Run Biome checks across the project      |
| `bun run format`       | Format the project with Biome            |
| `bun run setup`        | Copy static assets into `dist/`          |
| `bun run test`         | Run Playwright component tests           |
| `bun run test:e2e`     | Run Playwright end-to-end tests          |
| `bun run test:setup`   | Install Playwright Chromium dependencies |
