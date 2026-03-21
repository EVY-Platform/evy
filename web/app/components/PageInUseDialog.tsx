import { useId } from "react";
import { createPortal } from "react-dom";
import { TriangleAlert } from "lucide-react";

import { LUCIDE_STROKE_WIDTH } from "../icons/iconSyntax";
import { useEscapeKey } from "../hooks/useEscapeKey";
import type { PageReferenceEntry } from "../utils/actionHelpers";
import { modalSharedCss } from "./modalSharedCss";
import { pageInUseDialogCss } from "./pageInUseDialogCss";

type PageInUseDialogProps = {
	references: PageReferenceEntry[];
	onClose: () => void;
};

export function PageInUseDialog({ references, onClose }: PageInUseDialogProps) {
	const titleId = useId();

	useEscapeKey(onClose, references.length > 0);

	if (references.length === 0) return null;

	return createPortal(
		<>
			<style>{`${modalSharedCss}\n${pageInUseDialogCss}`}</style>
			<div className="evy-modal-root">
				<button
					type="button"
					className="evy-modal-backdrop"
					aria-label="Close dialog"
					onClick={onClose}
					data-testid="page-in-use-overlay"
				/>
				<div
					className="evy-modal-panel evy-modal-panel--page-in-use"
					role="dialog"
					aria-modal="true"
					aria-labelledby={titleId}
					data-testid="page-in-use-dialog"
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
							This page is being referenced in the following pages and rows:
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
				</div>
			</div>
		</>,
		document.body,
	);
}
