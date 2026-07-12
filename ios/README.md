# evy iOS App

The EVY app! Open Xcode, hit run, and Bob's your uncle.

### Prerequisites

The Xcode project references generated Swift types under `types/generated/swift`, which are gitignored and produced by codegen. On a fresh checkout, run this from the repo root **before** opening Xcode or building:

```sh
bun run types:generate
```

### Build

Open `ios/evy.xcodeproj` in Xcode and run the `evy` scheme against the **iPhone 17** simulator on **iOS 26.5** (see root `AGENTS.md`), or from the command line:

```sh
xcodebuild -project ios/evy.xcodeproj -scheme evy -destination 'platform=iOS Simulator,name=iPhone 17' build
```

### Tests

Run the `evyTests` unit test target:

```sh
xcodebuild test -project ios/evy.xcodeproj -scheme evy -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:evyTests
```

The `e2e` (XCUITest) target additionally requires backend services running; see the root `run-e2e.sh`.

### Architecture

```mermaid
flowchart LR
    App[ContentView<br/>NavigationStack]
    SDUI[EVYPage / EVYRow<br/>server-defined screens]
    Actions[EVYActionRunner]
    EVY[EVY facade<br/>expressions + mutations]
    Scope[EVYScope<br/>page data context]
    API[Backend API<br/>WebSocket + files]

    subgraph data [Local data]
        direction TB
        Synced[Synced resources]
        Drafts[In-progress drafts]
    end

    Record{{evyRecordChanged<br/>typed EVYRecordChange}}
    Value{{evyValueChanged<br/>watch-key string}}

    API -->|SDUI + sync| Synced
    App -->|render current screen| SDUI
    App -->|provide route scope| Scope
    Scope --> SDUI
    Scope --> EVY

    SDUI -->|read/write through| EVY
    SDUI -->|taps| Actions
    Actions -->|navigate / create / close| App
    Actions -->|create & submit| EVY

    EVY --> Synced
    EVY --> Drafts
    EVY -->|files| API

    Synced -.->|record reload| Record
    Synced -.->|value watchers| Value
    Drafts -.->|draft prop-path watchers| Value
    Record -.->|reload flow/page/row records| App
    Record -.->|reload page/row records| SDUI
    Value -.->|recompute EVYState| SDUI
    API -.->|errors| App
```

### Architectural highlights

**sync**: At startup, the app calls the API and stores each returned resource under a service-qualified key: `<service>:<resource>` (for example, `[evy_core_service_id]:flows`, `[evy_core_service_id]:pages`, `[evy_core_service_id]:rows`, `[marketplace_service_id]:[items_resource_id]`, or `[marketplace_service_id]:[conditions_resource_id]`).

**page scope**: Each rendered page carries an `EVYScope` with the cache scope for page query params and the draft scope for create flows. This keeps route context explicit through the SwiftUI tree while preserving the existing expression and mutation entry points.

**change propagation**: Record reloads and expression watchers use separate NotificationCenter channels. `evyRecordChanged` carries a typed `EVYRecordChange` for flow/page/row reloads; `evyValueChanged` carries a watch-key string for `EVYState` recomputation, including resource collection changes and draft prop-path updates.

**page parameters**: Pages can receive query parameters through navigation actions, think of them like URL query parameters in web. They get resolved against resources already synced by the app, or draft data in progress (eg a booking you are in the process of making).

**file uploads**: send binary frames over the authenticated WebSocket and finalise with a `create` RPC. If finalisation fails, a `cancelUpload` RPC cleans up the staged upload. Remote files are fetched via a `get` RPC and cached locally for rendering.
