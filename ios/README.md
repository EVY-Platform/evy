# evy iOS App

The EVY app! Open Xcode, hit run, and Bob's your uncle.

### Architecture

```mermaid
flowchart LR
    App[ContentView<br/>NavigationStack]
    SDUI[SDUI<br/>server-defined screens & widgets]
    Actions[Action runner<br/>navigate / create / close]
    EVY[EVY facade<br/>expressions + functions]
    API[Backend API<br/>WebSocket + file uploads]

    subgraph data [Local data]
        direction TB
        Synced[Synced resources]
        Drafts[In-progress drafts]
    end

    Notif{{NotificationCenter}}

    API -->|deliver the SDUI definition for every screen| SDUI
    App -->|render the current screen from| SDUI

    SDUI -->|read text & props through expressions| EVY
    SDUI -->|user edits write entered values back| EVY
    SDUI -->|button taps trigger| Actions

    Actions -->|push pages & close sheets| App
    Actions -->|create & submit entities via| EVY

    API -->|sync resources at launch| Synced
    EVY -->|look up & format synced values| Synced
    EVY -->|read & write the working draft| Drafts
    EVY -->|persist, fetch & upload files| API

    Synced -.->|post change| Notif
    Drafts -.->|post change| Notif
    API -.->|push live updates & errors| Notif

    Notif -.->|re-render the affected widgets| SDUI
    Notif -.->|refresh screen & surface errors| App
```

### Architectural highlights

**sync**: At startup, the app calls the API and stores each returned resource under a service-qualified key: `<service>:<resource>` (for example, `[evy_core_service_id]:flows`, `[evy_core_service_id]:pages`, `[evy_core_service_id]:rows`, `[marketplace_service_id]:[items_resource_id]`, or `[marketplace_service_id]:[conditions_resource_id]`).

**page parameters**: Pages can receive query parameters through navigation actions, think of them like URL query parameters in web. They get resolved against resources already synced by the app, or draft data in progress (eg a booking you are in the process of making).

**file uploads**: send binary frames over the authenticated WebSocket and finalise with a `create` RPC. If finalisation fails, a `cancelUpload` RPC cleans up the staged upload. Remote files are fetched via a `get` RPC and cached locally for rendering.
