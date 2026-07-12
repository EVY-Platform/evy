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
	return debounce(async () => {
		console.log(`[watch] ${label}`);
		try {
			await $`bun run ${script}`;
		} catch (error) {
			console.error(`[watch] ${script} failed:`, error);
		}
	}, 300);
}

watch(
	"./types",
	{ recursive: true },
	makeWatcher("types/ changed → types:generate", "types:generate"),
);

for (const file of [
	"./scripts/fixtures/evy/evy_sdui.json",
	"./scripts/fixtures/services/service_data.json",
	"./scripts/fixtures/services/service_sdui.json",
]) {
	watch(file, makeWatcher("seed data changed → db:seed", "db:seed"));
}

console.log("[watch] watching types/ and seed JSON files…");
