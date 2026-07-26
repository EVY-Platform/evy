import { TriangleAlert } from "lucide-react";
import { useId } from "react";
import { LUCIDE_STROKE_WIDTH } from "../icons/iconSyntax";
import type { PageReferenceEntry } from "../utils/pageReferences";
import { Modal } from "./Modal";

type PageInUseDialogProps = {
	references: PageReferenceEntry[];
	onClose: () => void;
};

export function PageInUseDialog({ references, onClose }: PageInUseDialogProps) {
	const titleId = useId();

	if (references.length === 0) return null;

	return (
		<Modal
			onClose={onClose}
			panelClassName="evy-modal-panel--page-in-use"
			labelledBy={titleId}
			panelTestId="page-in-use-dialog"
			backdropTestId="page-in-use-overlay"
		>
			<div className="evy-page-in-use-header evy-flex evy-items-center evy-gap-2">
				<TriangleAlert
					className="evy-h-4 evy-w-4 evy-shrink-0"
					strokeWidth={LUCIDE_STROKE_WIDTH}
					aria-hidden
				/>
				<span className="evy-text-lg evy-font-semibold" id={titleId}>
					Page in use
				</span>
			</div>

			<div className="evy-page-in-use-body">
				<p className="evy-page-in-use-description">
					This page is being referenced in the following pages and
					rows:
				</p>
				<ul className="evy-page-in-use-list">
					{references.map((ref) => (
						<li key={ref.referenceKey}>
							{ref.pageLabel}: {ref.rowLabel}
						</li>
					))}
				</ul>
			</div>

			<div className="evy-modal-footer evy-modal-footer--center">
				<button
					type="button"
					className="evy-modal-btn evy-modal-btn--md evy-modal-btn-primary"
					onClick={onClose}
					data-testid="page-in-use-dismiss"
				>
					Ok, let me remove those references first
				</button>
			</div>
		</Modal>
	);
}
