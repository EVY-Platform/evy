# evy iOS App

iOS consumer app. Minimum iOS version supported: **17.0** (matches `IPHONEOS_DEPLOYMENT_TARGET` in `evy.xcodeproj`).

**Types:** Schema and codegen are documented in [`docs/evy/types.md`](../docs/evy/types.md) and [`docs/evy/sdui/readme.md`](../docs/evy/sdui/readme.md). Run `bun run types:generate` from the repo root after cloning or schema changes ([Shared type system](../README.md#shared-type-system)). Generated Swift under `types/generated/swift/` is not committed; the app references generated SDUI, core resource, OS, and image API models, while transport and UI code such as `EVYFlow`, `EVYPage`, `EVYRow`, and `EVYWebsocket` remain handwritten where needed.

### Synced data

At startup, the app calls `sync` and stores each returned resource under a service-qualified key: `<service>:<resource>` (for example, `evy:sdui`, `marketplace:items`, or `marketplace:conditions`). Exact keys are preferred when app code needs a specific backend resource.

Pages can receive query parameters through navigation actions. Query params are passed as the optional third `navigate` argument using a plain-text query object that maps plural resource keys to scalar IDs, arrays of IDs, or `$datum` expressions (for example, `{navigate(flowId, pageId, {id: $datum.id})}`). Query values can be scalars (`{key: id}`) or arrays (`{key: [id-1, id-2]}`). iOS parses the query into a `[String: [String]]` dictionary. When the page opens, iOS resolves each resource key locally, picks the first ID from the already-synced collection, and stores the matching entity under the same plural key so bindings like `{items}` render the selected row. A generic `"id"` query key scans synced collections and stores the first matching entity under that collection's plural resource key. When no synced collection exists for a query key, iOS stores the raw string array under that key.

SDUI bindings use plural resource-only names such as `{conditions}` or `{timeslots}`. Edit rows write drafts through plural destinations such as `{item.title}` or `{item.condition}`. Those bindings resolve exact local keys first, then explicitly fall back to synced service resources. Search rows and dynamic ListContainer rows read local/synced data from their `source` and render `view.content.child` templates using `{$datum.}`. This keeps local draft/entity data separate from backend resource data while preserving simple SDUI source strings.

### Search result ordering

When the backend returns a collection (via sync or a `dataChanged` notification envelope), the
response includes `metadata.order` — an array of IDs in display order. iOS stores each item with
a `sortIndex` equal to its position in that array, so `getAll` returns items in backend order.
Items created locally or received via single-item notifications are assigned `sortIndex =
maxExisting + 1` so they append to the end. No separate order-state layer is needed.

### Image uploads and remote images

`EVYAPIManager.uploadImage(_:mimeType:)` uploads JPEG/PNG data over the existing authenticated WebSocket. It generates an image UUID, sends ordered 256 KB binary frames encoded by `Data.uploadFrames(uploadId:mimeType:)`, then finalises the upload with the protected `create` RPC for `service: "evy"`, `resource: "images"`. If finalisation fails, it calls `cancelUpload` for the staged upload ID.

`EVYAPIManager.getImage(id:)` reads image rows through the generic `get` RPC and expects generated `ImageWithBinary` data (`id`, `type`, timestamps, `dataBase64`). `EVYRemoteImage` and `EVYImageCache` load and cache these responses for rendering. Image RPC parameter and response models come from generated Swift output for `types/schema/images/image.schema.json`; `EVYImageRPC.swift` keeps only the aliases and binary frame encoding needed by the app.

### Draft scopes and draft cache keys

iOS drafts are stored in the in-memory draft cache, separate from public/private SwiftData stores.

Draft scope IDs use `<flowId>:<entityKey>` with a plural entity key (for example, `create-flow:items`). Reserved scopes include `<flowId>:browse`, `app:unscoped`, and `ephemeral:<uuid>`.

Full internal draft cache keys append the mode/path segment with another colon: `<flowId>:<entityKey>:<modeFlag><base64Path>` (for example, `create-flow:items:aWyJ0aXRsZSJd`). Because scope IDs also contain `:`, draft key parsing splits on the last colon. The mode flag is `a` for alias-flat merge mode or `e` for explicit-path merge mode; the remaining path key is the base64-encoded JSON path.

These draft keys are distinct from service-qualified data keys like `marketplace:items` and SDUI binding prefixes like `{$local:address}`, `{$api:resource}`, and `{$datum.field}`.

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

    Content -->|sync services / fetch SDUI| EVY
    Content -->|render| EVYPage
    EVYPage --> Page
    EVYPage --> EVYRow[EVYRow dispatcher]
    EVYRow --> Row

    subgraph rows [UI/Rows]
        Action[Action<br/>Button]
        Container[Container<br/>Column, List, SelectSegment, Sheet]
        Edit[Edit<br/>Calendar, Dropdown, InlinePicker, Input,<br/>Search, SelectPhoto, TextArea, TextSelect]
        ViewRows[View<br/>Info, InputList, Text]
    end
    EVYRow --> Action
    EVYRow --> Container
    EVYRow --> Edit
    EVYRow --> ViewRows

    Views[UI/Views<br/>EVYButton, EVYCalendar, EVYDropdown, EVYInlinePicker,<br/>EVYInputList, EVYMap, EVYSearch, EVYSelectList,<br/>EVYSelectPhoto, EVYTextField, EVYTimeslotPicker, ...]
    Atoms[UI/Atoms<br/>CarouselIndicator, RadioButton,<br/>Rectangle, RowTitle, TextView]
    Action --> Views
    Edit --> Views
    Container --> Views
    ViewRows --> Atoms
    Views --> Atoms

    EVY[[EVY facade<br/>getDataFromText / getDataFromProps / sync<br/>create / updateValue / updateData<br/>ensureDraftExists / formatData / evaluateFromText<br/>resolveQueryParams]]
    Action -->|run| Runner[EVYActionRunner<br/>navigate / create / close /<br/>highlight_required]
    Runner --> Content
    Runner --> EVY

    Edit -->|read & write bindings| EVY
    ViewRows -->|read bindings| EVY
    Container -->|read bindings| EVY

    Interpreter[interpreter.swift<br/>parsePropsFromText / splitPropsFromText /<br/>parseTextFromText / parseFunctionCall /<br/>splitFunctionArguments]
    Functions[functions.swift<br/>count, length, format*,<br/>build*, compare, ...]
    EVY --> Interpreter
    EVY --> Functions
    Functions --> EVY

    RowVisitor[forEachRow<br/>recursive row visitor]
    Content -->|extract create keys| RowVisitor
    EVYPage -->|bootstrap drafts| RowVisitor
    RowVisitor --> Row

    subgraph data [Data]
        PublicStore[EVYDataStore public<br/>server-synced SwiftData]
        PrivateStore[EVYDataStore private<br/>$local SwiftData]
        DraftStore[EVYDraftStore<br/>in-memory draft cache + active scope]
        EntityModel[(EVYData)]
        DraftPath[EVYDraft.Binding<br/>scopeId + pathSegments + mergeMode]
        PublicStore --> EntityModel
        PrivateStore --> EntityModel
        DraftStore --> EntityModel
        DraftStore --> DraftPath
    end
    EVY --> PublicStore
    EVY --> PrivateStore
    EVY --> DraftStore

    Views -->|Search rows read local synced resources| EVY

    subgraph api [Data/API]
        APIManager[EVYAPIManager shared auth subscriptions image upload]
        WS[EVYWebsocket JSON-RPC and binary frames]
        ImageRPC[EVYImageRPC generated aliases frame encoding]
        APIManager --> WS
        APIManager --> ImageRPC
    end
    RemoteImage[EVYRemoteImage EVYImageCache]
    Views --> RemoteImage
    RemoteImage --> APIManager
    EVY -->|fetch / create / update| APIManager

    Notif{{NotificationCenter<br/>.evyDataChanged<br/>.evyErrorOccurred}}
    PublicStore -. post .-> Notif
    DraftStore -. post .-> Notif
    EVY -. post .-> Notif
    Runner -. post .-> Notif
    WS -. post .-> Notif
    Views -. post errors .-> Notif
    Notif -. observe .-> Content
    Notif -. observe .-> EVYState["EVYState T"]
    Notif -. observe .-> Views
    EVYState -. drives .-> Views
    EVYState -. drives .-> Atoms
```
