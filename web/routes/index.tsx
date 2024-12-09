import Panel from "../components/Panel.tsx";
import Canva from "../components/Canva.tsx";

export default function Home() {
	return (
		<div class="flex">
			<div class="w-48">
				<Panel></Panel>
			</div>
			<div class="mx-auto">
				<Canva></Canva>
			</div>
			<div class="w-48">
				<Panel></Panel>
			</div>
		</div>
	);
}
