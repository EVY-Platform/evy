# evy iOS App

iOS consumer app. Minimum iOS version supported: **17.0** (matches `IPHONEOS_DEPLOYMENT_TARGET` in `evy.xcodeproj`).

For local and e2e runs, set `API_HOST` in the repository root `.env` (see [README § Setup](../README.md#setup); e.g. `API_HOST=localhost:8000`).

**Types:** Schema and codegen are documented in [`docs/evy/types.md`](../docs/evy/types.md) and [`docs/evy/sdui/readme.md`](../docs/evy/sdui/readme.md). Run `bun run types:generate` from the repo root after cloning or schema changes ([Shared type system](../README.md#shared-type-system)). Generated Swift under `types/generated/swift/` is not committed; the app also keeps hand-written `Codable` models (e.g. `EVYFlow`, `EVYPage`, `EVYRow`, `EVYWebsocket`) aligned with `types/schema/`.

### Architecture

```mermaid
flowchart LR
    App[evyApp]
    Content[ContentView<br/>NavigationStack]
    App --> Content

    subgraph sdui [SDUI tree]
        Flow[UI_Flow]
        Page[UI_Page]
        Row[UI_Row]
        Flow --> Page --> Row
        Row -->|child / children| Row
    end

    Content -->|fetch SDUI| EVY
    Content -->|render| EVYPage
    EVYPage --> Page
    EVYPage --> EVYRow[EVYRow dispatcher]
    EVYRow --> Row

    subgraph rows [UI/Rows]
        Action[Action<br/>Button, TextAction]
        Container[Container<br/>Column, List, SelectSegment, Sheet]
        Edit[Edit<br/>Calendar, Dropdown, InlinePicker, Input,<br/>Search, SelectPhoto, TextArea, TextSelect]
        ViewRows[View<br/>Info, InputList, Text]
    end
    EVYRow --> Action
    EVYRow --> Container
    EVYRow --> Edit
    EVYRow --> ViewRows

    Views[UI/Views<br/>EVYCalendar, EVYDropdown, EVYInlinePicker,<br/>EVYInputList, EVYMap, EVYSearch, EVYSelectList,<br/>EVYSelectPhoto, EVYTextField, EVYTimeslotPicker, ...]
    Atoms[UI/Atoms<br/>CarouselIndicator, RadioButton,<br/>Rectangle, RowTitle, TextView]
    Action --> Views
    Edit --> Views
    Container --> Views
    ViewRows --> Atoms
    Views --> Atoms

    EVY[[EVY facade<br/>getData / getSDUI / create<br/>getDataFromText / updateValue<br/>ensureDraftExists / formatData]]
    Action -->|run| Runner[EVYActionRunner<br/>navigate / create / close /<br/>highlight_required]
    Runner --> Content
    Runner --> EVY

    Edit -->|read & write bindings| EVY
    ViewRows -->|read bindings| EVY
    Container -->|read bindings| EVY

    Interpreter[interpreter.swift<br/>parseProps / splitProps /<br/>parseTextFromText / parseFunctionCall]
    Functions[functions.swift<br/>count, length, format*,<br/>build*, compare, ...]
    EVY --> Interpreter
    EVY --> Functions
    Functions --> EVY
    RowTree[EVYRowTree<br/>DFS walk]
    Content --> RowTree
    EVYPage --> RowTree

    subgraph data [Data]
        Manager[EVYDataManager<br/>SwiftData ModelContext]
        EntityModel[(EVYData)]
        DraftModel[(EVYDraft)]
        DraftPath[EVYDraft.binding / EVYDraft.Scope<br/>scopeId = flowId#entityKey]
        Manager --> EntityModel
        Manager --> DraftModel
        Manager --> DraftPath
    end
    EVY --> Manager

    subgraph api [Data/API]
        APIManager[EVYAPIManager.shared]
        WS[EVYWebsocket<br/>JSON-RPC over WebSocket]
        APIManager --> WS
    end
    EVY -->|fetch / upsert| APIManager

    Notif{{NotificationCenter<br/>.evyDataUpdated<br/>.evyFlowUpdated<br/>.evyErrorOccurred}}
    Manager -. post .-> Notif
    EVY -. post .-> Notif
    WS -. post .-> Notif
    Notif -. observe .-> Content
    Notif -. observe .-> EVYState["EVYState T"]
    EVYState -. drives .-> Views
    EVYState -. drives .-> Atoms
```
