import { watch } from "node:fs";
import { $ } from "bun";

function debounce(fn: () => void, ms: number) {
	let timer: Timer;
	return () => {
		clearTimeout(timer);
		timer = setTimeout(fn, ms);
	};
}

function makeWatcher(label: string, script: string) {
	let running = false;
	let rerunRequested = false;

	const run = async () => {
		if (running) {
			rerunRequested = true;
			return;
		}

		running = true;
		do {
			rerunRequested = false;
			console.log(`[watch] ${label}`);
			try {
				await $`bun run ${script}`;
			} catch (error) {
				console.error(`[watch] ${script} failed:`, error);
			}
		} while (rerunRequested);
		running = false;
	};

	return debounce(() => {
		void run();
	}, 300);
}

watch(
	"./types/schema",
	{ recursive: true },
	makeWatcher("types/schema changed → types:generate", "types:generate"),
);

for (const file of [
	"./scripts/fixtures/evy/evy_sdui.json",
	"./scripts/fixtures/services/service_data.json",
	"./scripts/fixtures/services/service_sdui.json",
]) {
	watch(file, makeWatcher("seed data changed → db:seed", "db:seed"));
}

console.log("[watch] watching types/schema/ and seed JSON files…");
