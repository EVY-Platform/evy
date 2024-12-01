import Logo from "./Logo.tsx";

export default function Navbar() {
	return (
		<nav class="bg-gray-50 flex flex-wrap items-center justify-between p-4">
			<Logo />
			<a href="/about" class="navbar-solid-bg font-medium">
				About
			</a>
		</nav>
	);
}
