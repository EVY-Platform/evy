import { useContext } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider, AppContext } from "./registry.tsx";
import { RowsPanel } from "./components/RowsPanel.tsx";
import { ConfigurationPanel } from "./components/ConfigurationPanel.tsx";
import AppPage from "./components/AppPage.tsx";

function AppContent() {
	const { pages } = useContext(AppContext);

	return (
		<>
			<div
				className="border-r border-gray overflow-y-auto"
				style={{ width: "280px" }}
			>
				<RowsPanel key="rows" />
			</div>
			<div className="flex flex-1 overflow-y-auto flex-row gap-2">
				{pages.map((page) => {
					return (
						<div
							key={page.pageId}
							className="bg-[url('/phone.svg')] bg-no-repeat bg-contain w-[336px] h-[662px]"
						>
							<AppPage pageId={page.pageId} />
						</div>
					);
				})}
			</div>
			<div
				className="border-l border-gray overflow-y-auto"
				style={{ width: "280px" }}
			>
				<ConfigurationPanel key="configuration" />
			</div>
		</>
	);
}

function App() {
	return (
		<AppProvider>
			<div className="h-screen flex flex-col overflow-hidden">
				<div className="border-b border-gray p-4">
					<a href="/">
						<img className="h-4" src="/logo.svg" alt="EVY" />
					</a>
				</div>
				<div className="flex flex-1 overflow-hidden">
					<AppContent />
				</div>
			</div>
		</AppProvider>
	);
}

const container = document.getElementById("root");
if (container) {
	const root = createRoot(container);
	root.render(<App />);
}
